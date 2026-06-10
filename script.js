const header = document.querySelector("[data-header]");
const toggle = document.querySelector("[data-menu-toggle]");
const nav = document.querySelector("[data-nav]");
const form = document.querySelector("[data-form]");
const statusText = document.querySelector("[data-form-status]");

function updateHeader() {
  header.classList.toggle("scrolled", window.scrollY > 18);
}

updateHeader();
window.addEventListener("scroll", updateHeader, { passive: true });

toggle.addEventListener("click", () => {
  const isOpen = header.classList.toggle("menu-open");
  toggle.setAttribute("aria-label", isOpen ? "Close navigation" : "Open navigation");
});

nav.addEventListener("click", (event) => {
  if (event.target.matches("a")) {
    header.classList.remove("menu-open");
    toggle.setAttribute("aria-label", "Open navigation");
  }
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(form);
  const name = formData.get("name").toString().trim();
  const room = formData.get("room");

  statusText.textContent = `Thanks${name ? `, ${name}` : ""}. Your ${room} enquiry has been noted. The Vikings Livinn team can confirm availability and visit timing.`;
  form.reset();
});
