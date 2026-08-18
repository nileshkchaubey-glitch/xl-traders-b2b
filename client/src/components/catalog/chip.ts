/** One definition of the filter-chip look, shared by the sheet and the active
 *  filter row so the two cannot drift apart. */
export function chipClass(active: boolean): string {
  return `h-10 flex-shrink-0 rounded-full border-[1.5px] px-3.5 text-body-sm font-semibold transition ${
    active
      ? "border-red-600 bg-red-50 text-red-600"
      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
  }`;
}
