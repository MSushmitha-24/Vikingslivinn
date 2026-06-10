const receiptList = document.querySelector("[data-receipt-list]");
const complaintForm = document.querySelector("[data-complaint-form]");
const complaintStatus = document.querySelector("[data-complaint-status]");

function formatMonth(value) {
  return new Date(`${value}-01T00:00:00`).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric"
  });
}

async function loadReceipts() {
  const data = await apiFetch("/api/customer/receipts");
  receiptList.innerHTML = data.receipts.length
    ? data.receipts.map((receipt) => `
        <article class="receipt-item">
          <div>
            <strong>${formatMonth(receipt.month)}</strong>
            <span>Rs. ${receipt.amount} | ${receipt.receiptNumber}</span>
          </div>
          <a class="btn ghost" href="/api/customer/receipts/${receipt._id}/download" data-download>Download</a>
        </article>
      `).join("")
    : "<p>No receipts are available yet.</p>";
}

receiptList.addEventListener("click", (event) => {
  if (!event.target.matches("[data-download]")) {
    return;
  }

  event.preventDefault();
  window.location.href = `${event.target.href}?token=${encodeURIComponent(getToken())}`;
});

complaintForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  complaintStatus.textContent = "Submitting complaint...";
  const formData = new FormData(complaintForm);

  try {
    const data = await apiFetch("/api/customer/complaints", {
      method: "POST",
      body: JSON.stringify(Object.fromEntries(formData))
    });
    complaintStatus.textContent = data.message;
    complaintForm.reset();
  } catch (error) {
    complaintStatus.textContent = error.message;
  }
});

requireRole("customer").then((user) => {
  if (user) {
    loadReceipts();
  }
});
