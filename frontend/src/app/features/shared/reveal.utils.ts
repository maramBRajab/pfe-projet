export function activateRevealElements(offset = 80): void {
  const elements = document.querySelectorAll<HTMLElement>('.reveal');

  elements.forEach((element) => {
    const elementTop = element.getBoundingClientRect().top;

    if (elementTop < window.innerHeight - offset) {
      element.classList.add('active');
    }
  });
}