// Shared-chrome includes for a plain static site (no Jekyll, no build step).
//
// Each page is just a <title> plus its body content wrapped in
// <template id="page">. This script fetches base.html (which holds the
// <head>, header and footer), drops the page content into the template's
// <main id="content"> slot, and swaps the assembled page into the document.
//
// To add a page: copy any existing page, change the <title>, and fill in the
// <template id="page"> body. Shared layout lives only in base.html.

(async () => {
    // include.js may be loaded from <head> before the body is parsed, so wait
    // for the page's own DOM before reading its content.
    if (document.readyState === 'loading') {
        await new Promise((r) =>
            document.addEventListener('DOMContentLoaded', r, { once: true })
        );
    }

    const pageTitle = document.title;
    const pageContent = document.getElementById('page');

    const res = await fetch('/base.html');
    if (!res.ok) {
        console.error('include.js: failed to load base.html', res.status);
        return;
    }

    const doc = new DOMParser().parseFromString(await res.text(), 'text/html');

    // Per-page title wins over the template's default.
    if (pageTitle) doc.title = pageTitle;

    // Pour this page's body into the template's content slot.
    const slot = doc.getElementById('content');
    if (slot && pageContent) slot.append(pageContent.content.cloneNode(true));

    // Swap the assembled document in. innerHTML-inserted <script> tags do not
    // execute, so we recreate them below.
    document.documentElement.innerHTML = doc.documentElement.innerHTML;

    document.querySelectorAll('script').forEach((old) => {
        const s = document.createElement('script');
        for (const attr of old.attributes) s.setAttribute(attr.name, attr.value);
        s.textContent = old.textContent;
        old.replaceWith(s);
    });
})();
