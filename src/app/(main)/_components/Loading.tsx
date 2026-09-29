/**
 * What the content area shows the instant a menu item is clicked, until the
 * page's data arrives. Grey blocks in roughly the shape of a console page, so
 * the layout does not jump when the real page replaces it.
 */
export function ConsoleLoading() {
  return (
    <div className="pf-loading" role="status" aria-live="polite" aria-label="Loading">
      <div className="sk-row">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="sk sk-card" />
        ))}
      </div>
      <div className="sk sk-title" />
      <div className="sk sk-line" />
      <div className="sk sk-line short" />
      <div className="sk sk-block" />
    </div>
  );
}

/** The student app's equivalent, laid out like its screens. */
export function StudentLoading() {
  return (
    <div className="m-app pf-loading" role="status" aria-live="polite" aria-label="Loading">
      <div className="m-loading-pad">
        <div className="sk sk-title" />
        <div className="sk sk-line short" />
        <div className="sk sk-card tall" />
        <div className="sk sk-card tall" />
        <div className="sk sk-card tall" />
      </div>
    </div>
  );
}
