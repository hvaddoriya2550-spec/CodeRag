import os
from typing import Optional

from tree_sitter_language_pack import get_parser as _get_ts_parser

# ── Language mapping ──────────────────────────────────────────────────────────

_EXT_TO_LANG: dict[str, str] = {
    ".py": "python",
    ".js": "javascript",
    ".ts": "typescript",
    ".jsx": "javascript",
    ".tsx": "typescript",
}

# Node types whose text we want to capture as individual chunks
_CHUNK_NODES: dict[str, set[str]] = {
    "python": {"function_definition", "class_definition"},
    "javascript": {
        "function_declaration", "class_declaration",
        "method_definition", "arrow_function", "export_statement",
    },
    "typescript": {
        "function_declaration", "class_declaration",
        "method_definition", "arrow_function", "export_statement",
    },
}

_CLASS_NODES = {"class_definition", "class_declaration"}

# ── Parser cache ──────────────────────────────────────────────────────────────

_parser_cache: dict[str, object] = {}


def get_parser(extension: str):
    lang = _EXT_TO_LANG.get(extension.lower())
    if lang is None:
        return None
    if lang not in _parser_cache:
        _parser_cache[lang] = _get_ts_parser(lang)
    return _parser_cache[lang]


# ── Node helpers ──────────────────────────────────────────────────────────────

def get_node_text(node, source_bytes: bytes) -> str:
    return source_bytes[node.start_byte:node.end_byte].decode("utf-8", errors="ignore")


def _get_node_name(node) -> str:
    """Return the name of a function/class node, or '' if not found."""
    for child in node.children:
        if child.type in ("identifier", "type_identifier", "property_identifier"):
            return child.text.decode("utf-8", errors="ignore")
    return ""


# ── Main extraction ───────────────────────────────────────────────────────────

def extract_chunks_from_file(
    file_path: str,
    relative_path: str,
    source_code: str,
) -> list[dict]:
    ext = os.path.splitext(file_path)[1].lower()
    parser = get_parser(ext)
    if parser is None:
        return extract_by_lines(relative_path, source_code)

    source_bytes = source_code.encode("utf-8")
    try:
        tree = parser.parse(source_bytes)
    except Exception:
        return extract_by_lines(relative_path, source_code)

    lang = _EXT_TO_LANG[ext]
    target_types = _CHUNK_NODES[lang]
    chunks: list[dict] = []

    def walk(node):
        if node.type in target_types:
            name = _get_node_name(node)
            # For export_statement, try to get the name from the wrapped declaration
            if node.type == "export_statement" and not name:
                for child in node.children:
                    candidate = _get_node_name(child)
                    if candidate:
                        name = candidate
                        break

            chunk_type = "class" if node.type in _CLASS_NODES else "function"
            chunks.append({
                "content": get_node_text(node, source_bytes),
                "name": name or f"unnamed_{node.start_point[0] + 1}",
                "chunk_type": chunk_type,
                "file_path": relative_path,
                "start_line": node.start_point[0] + 1,
                "end_line": node.end_point[0] + 1,
            })
            # Still recurse — captures methods inside classes
        for child in node.children:
            walk(child)

    walk(tree.root_node)
    return chunks if chunks else extract_by_lines(relative_path, source_code)


# ── Line-based fallback ───────────────────────────────────────────────────────

def extract_by_lines(
    relative_path: str,
    source_code: str,
    chunk_size: int = 50,
    overlap: int = 10,
) -> list[dict]:
    lines = source_code.splitlines()
    chunks: list[dict] = []
    step = chunk_size - overlap
    i = 0
    while i < len(lines):
        end = min(i + chunk_size, len(lines))
        start_line = i + 1
        end_line = end
        chunks.append({
            "content": "\n".join(lines[i:end]),
            "name": f"lines_{start_line}-{end_line}",
            "chunk_type": "code_block",
            "file_path": relative_path,
            "start_line": start_line,
            "end_line": end_line,
        })
        i += step
    return chunks
