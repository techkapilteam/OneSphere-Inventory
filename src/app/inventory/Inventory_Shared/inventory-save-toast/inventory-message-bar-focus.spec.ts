import './inventory-save-toast.component';

const frame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));

// A page message bar scrolls into view and zooms once when it appears or its text changes, and always
// has an X; the X hides it until its next message.
describe('Inventory page message bars', () => {
  let scrolled: HTMLElement[];

  beforeEach(() => {
    scrolled = [];
    (Element.prototype as any).scrollIntoView = function (this: HTMLElement) { scrolled.push(this); };
    (Element.prototype as any).animate = () => ({});
  });
  afterEach(() => document.body.querySelectorAll('.inventory-save-error, .inventory-save-msg').forEach(e => e.remove()));

  it('scrolls to a new error bar and adds an X when it has none', async () => {
    const bar = document.createElement('div');
    bar.className = 'inventory-save-error';
    bar.innerHTML = '<span>Save failed</span>';
    document.body.appendChild(bar);
    await frame(); await frame();
    expect(scrolled).toContain(bar);
    expect(bar.querySelector('.inventory-alert-close')).toBeTruthy();
  });

  it('keeps a bar\'s own X (no second one) and the X hides the bar', async () => {
    const bar = document.createElement('div');
    bar.className = 'inventory-save-msg';
    bar.innerHTML = '<span>Saved</span><button class="inventory-alert-close"></button>';
    document.body.appendChild(bar);
    await frame(); await frame();
    expect(bar.querySelectorAll('.inventory-alert-close').length).toBe(1);

    const added = document.createElement('div');
    added.className = 'inventory-save-error';
    added.innerHTML = '<span>Oops</span>';
    document.body.appendChild(added);
    await frame(); await frame();
    (added.querySelector('.inventory-alert-close') as HTMLButtonElement).click();
    expect(added.style.display).toBe('none');
  });

  it('brings the bar into view again when its text changes', async () => {
    const bar = document.createElement('div');
    bar.className = 'inventory-save-msg';
    bar.innerHTML = '<span>First</span>';
    document.body.appendChild(bar);
    await frame(); await frame();
    scrolled.length = 0;
    bar.querySelector('span')!.textContent = 'Second';
    await frame(); await frame();
    expect(scrolled).toContain(bar);
  });
});
