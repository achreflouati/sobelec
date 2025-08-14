import frappe
from frappe.utils import flt, nowdate
from typing import List, Dict, Any

@frappe.whitelist()
def get_open_invoices(party_type: str, party: str) -> List[Dict[str, Any]]:
    """Récupère les factures impayées pour un client/fournisseur"""
    if not party_type or not party:
        return []

    if party_type == "Customer":
        doctype = "Sales Invoice"
        filters = {
            "docstatus": 1,
            "customer": party,
            "status": ["in", ["Unpaid", "Overdue", "Partly Paid"]]
        }
    else:
        doctype = "Purchase Invoice"
        filters = {
            "docstatus": 1,
            "supplier": party,
            "status": ["in", ["Unpaid", "Overdue", "Partly Paid"]]
        }

    invoices = frappe.get_all(
        doctype,
        filters=filters,
        fields=[
            "name", "posting_date", "due_date", "grand_total",
            "outstanding_amount", "status"
        ],
        order_by="posting_date desc"
    )

    for inv in invoices:
        inv["paid_amount"] = flt(inv["grand_total"]) - flt(inv["outstanding_amount"])

    return invoices

@frappe.whitelist()
def get_payment_options() -> Dict[str, Any]:
    """Récupère les modes de paiement et les comptes bancaires disponibles"""
    modes_of_payment = frappe.get_all(
        "Mode of Payment",
        filters={"docstatus": 1},
        fields=["name", "type"]
    )
    accounts = frappe.get_all(
        "Account",
        filters={
            "account_type": ["in", ["Bank", "Cash"]],
            "is_group": 0,
            "disabled": 0
        },
        fields=["name", "account_name", "account_type"]
    )
    return {"modes_of_payment": modes_of_payment, "accounts": accounts}

@frappe.whitelist()
def create_payment_entry(party_type: str, party: str, payment_data: Dict[str, Any], invoices: List[Dict[str, Any]], submit: bool = False) -> str:
    """Crée un Payment Entry pour les factures sélectionnées"""
    try:
        pe = frappe.new_doc("Payment Entry")
        pe.payment_type = "Receive" if party_type == "Customer" else "Pay"
        pe.party_type = party_type
        pe.party = party
        pe.company = frappe.defaults.get_default("company")

        pe.mode_of_payment = payment_data.get("mode_of_payment")
        pe.paid_from = payment_data.get("account") if party_type == "Customer" else payment_data.get("paid_from")
        pe.paid_to = payment_data.get("account") if party_type == "Supplier" else payment_data.get("paid_to")
        pe.reference_no = payment_data.get("reference_no")
        pe.reference_date = payment_data.get("reference_date") or nowdate()

        pe.paid_amount = flt(payment_data.get("amount"))
        pe.received_amount = pe.paid_amount

        for inv in invoices:
            pe.append("references", {
                "reference_doctype": "Sales Invoice" if party_type == "Customer" else "Purchase Invoice",
                "reference_name": inv.get("name"),
                "allocated_amount": min(flt(inv.get("outstanding_amount")), pe.paid_amount)
            })

        pe.setup_party_account_field()
        pe.set_missing_values()
        pe.set_exchange_rate()
        pe.set_amounts()

        pe.insert()
        if submit:
            pe.submit()

        return pe.name

    except Exception as e:
        frappe.log_error(f"Erreur création Payment Entry: {str(e)}")
        raise
