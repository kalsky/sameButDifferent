//! Integration tests for the compare core. Fixture trees are built in code with
//! `tempfile` — no committed binary fixtures.

use std::fs;
use std::path::Path;
use std::time::{Duration, SystemTime};
use tauri_app_lib::binary::{self, Media};
use tauri_app_lib::commands::scan_session;
use tauri_app_lib::diff::{self, HunkTag};
use tauri_app_lib::model::{Entry, EntryKind, Status};
use tempfile::TempDir;

fn write(dir: &Path, rel: &str, contents: &str) {
    let p = dir.join(rel);
    fs::create_dir_all(p.parent().unwrap()).unwrap();
    fs::write(p, contents).unwrap();
}

/// Force a file's mtime to a fixed instant so size+mtime equality is deterministic.
fn set_mtime(dir: &Path, rel: &str, secs: u64) {
    let t = SystemTime::UNIX_EPOCH + Duration::from_secs(secs);
    let f = fs::File::options()
        .write(true)
        .open(dir.join(rel))
        .unwrap();
    f.set_modified(t).unwrap();
}

fn find<'a>(tree: &'a [Entry], rel: &str) -> Option<&'a Entry> {
    for e in tree {
        if e.rel_path == rel {
            return Some(e);
        }
        if let Some(found) = find(&e.children, rel) {
            return Some(found);
        }
    }
    None
}

// 1. walk/merge: identical, only-in-A, only-in-B, nested dirs, file-vs-dir conflict.
#[test]
fn walk_merge_and_statuses() {
    let a = TempDir::new().unwrap();
    let b = TempDir::new().unwrap();

    // identical file (same content + mtime => Same without hashing)
    write(a.path(), "same.txt", "hello\n");
    write(b.path(), "same.txt", "hello\n");
    set_mtime(a.path(), "same.txt", 1000);
    set_mtime(b.path(), "same.txt", 1000);

    // only in A
    write(a.path(), "onlyA.txt", "a\n");
    // only in B
    write(b.path(), "onlyB.txt", "b\n");

    // nested dir, differing content (distinct mtime so the size+mtime shortcut
    // doesn't assume Same — same size, must fall through to hashing)
    write(a.path(), "nested/d.txt", "x\n");
    write(b.path(), "nested/d.txt", "y\n");
    set_mtime(a.path(), "nested/d.txt", 100);
    set_mtime(b.path(), "nested/d.txt", 200);

    // file-vs-dir conflict: "conf" is a file in A, a dir in B
    write(a.path(), "conf", "i am a file\n");
    write(b.path(), "conf/inner.txt", "i am a dir\n");

    let session = scan_session(vec![
        a.path().to_string_lossy().to_string(),
        b.path().to_string_lossy().to_string(),
    ]);

    assert_eq!(find(&session.tree, "same.txt").unwrap().status, Status::Same);
    assert_eq!(
        find(&session.tree, "onlyA.txt").unwrap().status,
        Status::OnlyIn(0)
    );
    assert_eq!(
        find(&session.tree, "onlyB.txt").unwrap().status,
        Status::OnlyIn(1)
    );
    assert_eq!(
        find(&session.tree, "nested/d.txt").unwrap().status,
        Status::Differ
    );
    // parent dir rolls up to Differ
    assert_eq!(find(&session.tree, "nested").unwrap().status, Status::Differ);
    // file-vs-dir => TypeConflict
    assert_eq!(
        find(&session.tree, "conf").unwrap().status,
        Status::TypeConflict
    );

    // sides populated: same.txt present on both
    let same = find(&session.tree, "same.txt").unwrap();
    assert!(same.sides[0].is_some() && same.sides[1].is_some());
}

// 2. compare ladder details.
#[test]
fn compare_ladder() {
    let a = TempDir::new().unwrap();
    let b = TempDir::new().unwrap();

    // same size + mtime => Same, and no hash computed (content_hash stays None)
    write(a.path(), "f1", "abcd\n");
    write(b.path(), "f1", "abcd\n");
    set_mtime(a.path(), "f1", 500);
    set_mtime(b.path(), "f1", 500);

    // same size, different mtime, SAME bytes => Same (hashed)
    write(a.path(), "f2", "abcd\n");
    write(b.path(), "f2", "abcd\n");
    set_mtime(a.path(), "f2", 500);
    set_mtime(b.path(), "f2", 999);

    // same size, different mtime, DIFFERENT bytes => Differ
    write(a.path(), "f3", "abcd\n");
    write(b.path(), "f3", "abce\n");
    set_mtime(a.path(), "f3", 500);
    set_mtime(b.path(), "f3", 999);

    // different size => Differ
    write(a.path(), "f4", "abcd\n");
    write(b.path(), "f4", "abcdefgh\n");

    let s = scan_session(vec![
        a.path().to_string_lossy().to_string(),
        b.path().to_string_lossy().to_string(),
    ]);

    let f1 = find(&s.tree, "f1").unwrap();
    assert_eq!(f1.status, Status::Same);
    // skip-read path: no hash was computed
    assert!(f1.sides[0].as_ref().unwrap().content_hash.is_none());

    assert_eq!(find(&s.tree, "f2").unwrap().status, Status::Same);
    assert_eq!(find(&s.tree, "f3").unwrap().status, Status::Differ);
    assert_eq!(find(&s.tree, "f4").unwrap().status, Status::Differ);
}

// 3. text diff hunk ops.
#[test]
fn text_diff_hunks() {
    let a = "one\ntwo\nthree\n";
    let b = "one\nTWO\nthree\nfour\n";
    let hunks = diff::diff_text(a, b);

    // there must be a Replace (two -> TWO) and an Insert (four)
    assert!(hunks.iter().any(|h| h.tag == HunkTag::Replace
        && h.a_lines == vec!["two\n"]
        && h.b_lines == vec!["TWO\n"]));
    assert!(hunks
        .iter()
        .any(|h| h.tag == HunkTag::Insert && h.b_lines == vec!["four\n"]));
    // and Equal context for "one"
    assert!(hunks
        .iter()
        .any(|h| h.tag == HunkTag::Equal && h.a_lines == vec!["one\n"]));
}

// 4. apply_hunk round-trips both directions.
#[test]
fn apply_hunk_round_trip() {
    let a = TempDir::new().unwrap();
    let b = TempDir::new().unwrap();
    write(a.path(), "f", "one\ntwo\nthree\n");
    write(b.path(), "f", "one\nCHANGED\nthree\n");

    let ar = a.path().to_string_lossy().to_string();
    let br = b.path().to_string_lossy().to_string();

    // copy the differing hunk from A into B
    let hunks = diff::diff_file_text(&ar, &br, "f").unwrap();
    let replace = hunks.iter().find(|h| h.tag == HunkTag::Replace).unwrap();
    let after = diff::apply_hunk(&ar, &br, "f", replace.id).unwrap();

    // B now equals A; no non-equal hunks remain
    assert_eq!(fs::read_to_string(b.path().join("f")).unwrap(), "one\ntwo\nthree\n");
    assert!(after.iter().all(|h| h.tag == HunkTag::Equal));
}

// 5. whole-file copy.
#[test]
fn copy_whole_file() {
    let a = TempDir::new().unwrap();
    let b = TempDir::new().unwrap();
    write(a.path(), "sub/new.txt", "fresh\n");

    let ar = a.path().to_string_lossy().to_string();
    let br = b.path().to_string_lossy().to_string();
    diff::copy_file(&ar, &br, "sub/new.txt").unwrap();

    assert_eq!(
        fs::read_to_string(b.path().join("sub/new.txt")).unwrap(),
        "fresh\n"
    );
}

// 6. binary sniff.
#[test]
fn binary_sniff() {
    assert!(binary::is_binary(b"abc\x00def"));
    assert!(!binary::is_binary("just text\n".as_bytes()));
    assert_eq!(binary::classify("a.txt", b"hello"), Media::Text);
    assert_eq!(binary::classify("a.png", b"\x89PNG"), Media::Image);
    assert_eq!(binary::classify("a.pdf", b"%PDF"), Media::Pdf);
    assert_eq!(binary::classify("a.bin", b"\x00\x01"), Media::Binary);
}

// 7. hex dump rows.
#[test]
fn hex_dump_rows() {
    let rows = binary::hex_dump(b"Hello", 0);
    assert_eq!(rows.len(), 1);
    assert_eq!(rows[0].offset, 0);
    assert_eq!(rows[0].hex, "48 65 6c 6c 6f");
    assert_eq!(rows[0].ascii, "Hello");
}

// 8. N-side readiness: 3 roots, sides.len() == 3, statuses compute.
#[test]
fn three_side_readiness() {
    let a = TempDir::new().unwrap();
    let b = TempDir::new().unwrap();
    let c = TempDir::new().unwrap();
    write(a.path(), "f", "x\n");
    write(b.path(), "f", "x\n");
    // missing on C => Partial (present on 2 of 3)

    let s = scan_session(vec![
        a.path().to_string_lossy().to_string(),
        b.path().to_string_lossy().to_string(),
        c.path().to_string_lossy().to_string(),
    ]);
    let f = find(&s.tree, "f").unwrap();
    assert_eq!(f.sides.len(), 3);
    assert_eq!(f.status, Status::Partial);
    assert_eq!(s.roots.len(), 3);
}

// keep EntryKind import used even if assertions above change
#[allow(dead_code)]
fn _kind_used(_k: EntryKind) {}
