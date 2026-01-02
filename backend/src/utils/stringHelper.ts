function convertToTitleCase(str: string): string {
    if (!str) {
        return str;
    }

    const trimmed = str.trim();
    if (trimmed.length === 0) {
        return trimmed;
    }


  return trimmed
    .split(/\s+/)
    .map(word =>
      word
        .split(/(-)/) // preserve hyphens
        .map(part => {
          if (part === "-") return part;
          const [first, ...rest] = [...part];
          return first
            ? first.toUpperCase() + rest.join("").toLowerCase()
            : "";
        })
        .join("")
    )
    .join(" ");
}