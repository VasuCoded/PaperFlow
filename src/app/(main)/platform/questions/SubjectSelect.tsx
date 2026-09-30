"use client";

/**
 * The subject filter: changing it reloads the list at once with that subject's
 * chapters (the chapter list is the subject's own, so a chapter from the old
 * subject is cleared rather than kept).
 */
export function SubjectSelect({ value, options }: { value: string; options: { id: string; label: string }[] }) {
  return (
    <select
      name="cs"
      className="sel"
      defaultValue={value}
      aria-label="Subject"
      onChange={(e) => {
        const form = e.currentTarget.form;
        if (!form) return;
        const ch = form.elements.namedItem("ch");
        if (ch instanceof HTMLSelectElement) ch.value = "";
        form.requestSubmit();
      }}
    >
      {options.map((o) => (
        <option key={o.id} value={o.id}>{o.label}</option>
      ))}
    </select>
  );
}
