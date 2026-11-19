// CourseFit project page — small progressive enhancements only.
(() => {
  const header = document.querySelector('.site-header');
  const onScroll = () => header?.classList.toggle('is-stuck', window.scrollY > 8);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  const copyButton = document.querySelector('[data-copy]');
  if (copyButton) {
    const label = copyButton.querySelector('span');
    let resetTimer;

    const confirm = () => {
      copyButton.classList.add('is-copied');
      label.textContent = 'Copied';
      clearTimeout(resetTimer);
      resetTimer = setTimeout(() => {
        copyButton.classList.remove('is-copied');
        label.textContent = 'Copy';
      }, 2000);
    };

    copyButton.addEventListener('click', async () => {
      const text = copyButton.dataset.copy || '';
      try {
        await navigator.clipboard.writeText(text);
        confirm();
      } catch {
        const field = document.createElement('textarea');
        field.value = text;
        field.setAttribute('readonly', '');
        field.style.position = 'fixed';
        field.style.opacity = '0';
        document.body.append(field);
        field.select();
        try { document.execCommand('copy'); confirm(); } catch { label.textContent = 'Press Ctrl+C'; }
        field.remove();
      }
    });
  }
})();
