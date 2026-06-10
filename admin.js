const customerForm = document.querySelector("[data-customer-form]");
const receiptForm = document.querySelector("[data-receipt-form]");
const customerStatus = document.querySelector("[data-customer-status]");
const receiptStatus = document.querySelector("[data-receipt-status]");
const customerSelect = document.querySelector("[data-customer-select]");
const complaintsTable = document.querySelector("[data-complaints-table]");
const refreshComplaints = document.querySelector("[data-refresh-complaints]");

function formatDate(value) {
  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

async function loadCustomers() {
  const data = await apiFetch("/api/admin/customers");
  customerSelect.innerHTML = data.customers.length
    ? data.customers.map((customer) => `<option value="${customer._id}">${customer.name} - ${customer.email}</option>`).join("")
    : '<option value="">No customers yet</option>';
}

async function loadComplaints() {
  const data = await apiFetch("/api/admin/complaints");
  complaintsTable.innerHTML = data.complaints.length
    ? data.complaints.map((complaint) => `
        <tr>
          <td>${complaint.customerName}<br /><small>${complaint.customerEmail}</small></td>
          <td>${complaint.subject}<br /><small>${formatDate(complaint.createdAt)}</small></td>
          <td>${complaint.message}</td>
          <td>
            <select data-complaint-status="${complaint._id}">
              ${["Open", "In Progress", "Resolved"].map((status) => `<option ${complaint.status === status ? "selected" : ""}>${status}</option>`).join("")}
            </select>
          </td>
        </tr>
      `).join("")
    : '<tr><td colspan="4">No complaints submitted yet.</td></tr>';
}

customerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  customerStatus.textContent = "Creating customer login...";
  const formData = new FormData(customerForm);

  try {
    const data = await apiFetch("/api/admin/customers", {
      method: "POST",
      body: JSON.stringify(Object.fromEntries(formData))
    });
    customerStatus.textContent = data.message;
    customerForm.reset();
    await loadCustomers();
  } catch (error) {
    customerStatus.textContent = error.message;
  }
});

receiptForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  receiptStatus.textContent = "Generating receipt...";
  const formData = new FormData(receiptForm);

  try {
    const data = await apiFetch("/api/admin/receipts", {
      method: "POST",
      body: JSON.stringify(Object.fromEntries(formData))
    });
    receiptStatus.textContent = `${data.message} Receipt no: ${data.receipt.receiptNumber}`;
    receiptForm.reset();
  } catch (error) {
    receiptStatus.textContent = error.message;
  }
});

complaintsTable.addEventListener("change", async (event) => {
  if (!event.target.matches("[data-complaint-status]")) {
    return;
  }

  await apiFetch(`/api/admin/complaints/${event.target.dataset.complaintStatus}`, {
    method: "PATCH",
    body: JSON.stringify({ status: event.target.value })
  });
});

refreshComplaints.addEventListener("click", loadComplaints);

requireRole("admin").then((user) => {
  if (!user) {
    return;
  }
  loadCustomers();
  loadComplaints();
});
