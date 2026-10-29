def mask_review_author(name: str | None) -> str:
    name = (name or "").strip()
    if not name:
        return "회원"
    if len(name) <= 2:
        return name[0] + "*"
    return name[0] + "*" * (len(name) - 2) + name[-1]
