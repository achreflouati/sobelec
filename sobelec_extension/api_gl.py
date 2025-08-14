# sobelec_extension/api_gl.py
from collections import defaultdict
from decimal import Decimal
import frappe
from frappe.utils import getdate


def _decimal(n):  # robust to None
    try:
        return Decimal(str(n or 0))
    except Exception:
        return Decimal(0)


@frappe.whitelist()
def get_gl_filter_options():
    """Options de filtres (entreprises, comptes, journaux, tiers, centres de coût, projets)."""
    companies = frappe.get_all("Company", fields=["name", "company_name"], order_by="name")
    accounts = frappe.get_all(
        "Account",
        fields=["name", "account_name", "company", "root_type", "is_group"],
        order_by="name",
    )
    voucher_types = sorted({d.name for d in frappe.get_all("DocType", filters={"istable": 0}, fields=["name"])})
    cost_centers = frappe.get_all("Cost Center", fields=["name", "cost_center_name", "company"], order_by="name")
    projects = frappe.get_all("Project", fields=["name", "project_name"], order_by="name")

    parties = frappe.get_all("Party Type", fields=["name"])  # Customer, Supplier, Employee, etc.

    return {
        "success": True,
        "data": {
            "companies": companies,
            "accounts": [a for a in accounts if not a.get("is_group")],
            "voucher_types": voucher_types,
            "cost_centers": cost_centers,
            "projects": projects,
            "party_types": parties,
        },
    }


def _build_conditions(filters):
    conds = []
    params = {}

    if filters.get("company"):
        conds.append("gle.company = %(company)s")
        params["company"] = filters["company"]

    if filters.get("from_date"):
        conds.append("gle.posting_date >= %(from_date)s")
        params["from_date"] = getdate(filters["from_date"])

    if filters.get("to_date"):
        conds.append("gle.posting_date <= %(to_date)s")
        params["to_date"] = getdate(filters["to_date"])

    if filters.get("account"):
        conds.append("gle.account = %(account)s")
        params["account"] = filters["account"]

    if filters.get("voucher_type"):
        conds.append("gle.voucher_type = %(voucher_type)s")
        params["voucher_type"] = filters["voucher_type"]

    if filters.get("voucher_no"):
        conds.append("gle.voucher_no = %(voucher_no)s")
        params["voucher_no"] = filters["voucher_no"]

    if filters.get("party_type"):
        conds.append("gle.party_type = %(party_type)s")
        params["party_type"] = filters["party_type"]

    if filters.get("party"):
        conds.append("gle.party = %(party)s")
        params["party"] = filters["party"]

    if filters.get("cost_center"):
        conds.append("gle.cost_center = %(cost_center)s")
        params["cost_center"] = filters["cost_center"]

    if filters.get("project"):
        conds.append("gle.project = %(project)s")
        params["project"] = filters["project"]

    # Recherche plein texte sur libellé/remarques
    if filters.get("search_text"):
        conds.append("(gle.remarks LIKE %(search)s OR gle.against LIKE %(search)s)")
        params["search"] = f"%{filters['search_text']}%"

    # Exclure les pièces annulées
    if str(filters.get("exclude_cancelled", 1)) in ("1", "true", "True"):
        conds.append("gle.is_cancelled = 0")

    return " AND ".join(conds) if conds else "1=1", params


def _sanitize_sort(sort_by: str | None, sort_order: str | None, has_account_filter: bool) -> tuple[str, str]:
    allowed_cols = {"posting_date", "voucher_no", "account"}
    # ordre par défaut inspiré CIEL
    if has_account_filter:
        default_sort_by = "posting_date, voucher_no"
    else:
        default_sort_by = "account, posting_date, voucher_no"

    sb = (sort_by or default_sort_by)
    # garder uniquement les colonnes autorisées, conserver l'ordre fourni si valide
    cols = [c.strip() for c in sb.split(",") if c.strip()]
    cols = [c for c in cols if c in allowed_cols]
    if not cols:
        cols = [c.strip() for c in default_sort_by.split(",")]
    sb_final = ", ".join(cols)

    so = (sort_order or "asc").lower()
    if so not in ("asc", "desc"):
        so = "asc"
    return sb_final, so


@frappe.whitelist()
def search_gl_entries(**kwargs):
    """
    Recherche paginée avec totaux et solde courant (à la CIEL).
    Args attendus :
      - from_date, to_date, company, account, voucher_type, voucher_no,
        party_type, party, cost_center, project, search_text, exclude_cancelled
      - limit (int), offset (int), sort_by, sort_order
      - include_opening_row (bool): ajoute une ligne de solde d'ouverture si un compte est sélectionné
    """
    filters = kwargs or {}
    limit = int(filters.get("limit") or 50)
    offset = int(filters.get("offset") or 0)

    sort_by, sort_order = _sanitize_sort(
        filters.get("sort_by"), filters.get("sort_order"), bool(filters.get("account"))
    )

    cond_sql, params = _build_conditions(filters)

    # Comptage total pour pagination
    total_count = frappe.db.sql(
        f"""SELECT COUNT(*) FROM `tabGL Entry` gle WHERE {cond_sql}""",
        params,
    )[0][0]

    # Totaux (débit/crédit) pour la vue actuelle
    totals_row = frappe.db.sql(
        f"""
        SELECT COALESCE(SUM(gle.debit),0), COALESCE(SUM(gle.credit),0)
        FROM `tabGL Entry` gle
        WHERE {cond_sql}
        """,
        params,
    )[0]
    total_debit, total_credit = map(Decimal, totals_row)

    # Solde d'ouverture par compte (si from_date fourni)
    running = defaultdict(Decimal)
    if filters.get("from_date"):
        opening_rows = frappe.db.sql(
            f"""
            SELECT gle.account, COALESCE(SUM(gle.debit - gle.credit), 0) bal
            FROM `tabGL Entry` gle
            WHERE {cond_sql.replace("gle.posting_date >= %(from_date)s", "gle.posting_date < %(from_date)s")}
            GROUP BY gle.account
            """,
            params,
            as_dict=True,
        )
        for r in opening_rows:
            running[r.account] = _decimal(r.bal)
        # snapshot des soldes d'ouverture par compte (avant l'itération des lignes de la page)
        opening_snapshot = dict(running)
    else:
        opening_snapshot = {}
    opening_balance_total = sum(running.values())

    # Récup des écritures page courante (+ libellé du compte)
    rows = frappe.db.sql(
        f"""
        SELECT
            gle.name, gle.posting_date, gle.account, acc.account_name, gle.account_currency,
            gle.debit, gle.credit, gle.debit_in_account_currency, gle.credit_in_account_currency,
            gle.against, gle.voucher_type, gle.voucher_no,
            gle.party_type, gle.party, gle.remarks,
            gle.company, gle.cost_center, gle.project
        FROM `tabGL Entry` gle
        LEFT JOIN `tabAccount` acc ON acc.name = gle.account
        WHERE {cond_sql}
        ORDER BY {sort_by} {sort_order}
        LIMIT %(limit)s OFFSET %(offset)s
        """,
        {**params, "limit": limit, "offset": offset},
        as_dict=True,
    )

    # Calcul du solde courant (running balance) PAR COMPTE
    for e in rows:
        acct = e["account"]
        running[acct] += _decimal(e["debit"]) - _decimal(e["credit"])
        e["running_balance"] = float(running[acct])

    # Ligne de solde d'ouverture optionnelle (si un compte précis est filtré)
    include_opening = str(filters.get("include_opening_row")) in ("1", "true", "True")
    if include_opening and filters.get("account") and filters.get("from_date"):
        acct = filters.get("account")
        # chercher libellé du compte
        acc_name = frappe.db.get_value("Account", acct, "account_name")
        open_row = {
            "name": None,
            "posting_date": None,
            "account": acct,
            "account_name": acc_name,
            "account_currency": None,
            "debit": 0,
            "credit": 0,
            "debit_in_account_currency": 0,
            "credit_in_account_currency": 0,
            "against": "",
            "voucher_type": "",
            "voucher_no": "",
            "party_type": "",
            "party": "",
            "remarks": "Solde d'ouverture",
            "company": filters.get("company"),
            "cost_center": "",
            "project": "",
            "running_balance": float(opening_snapshot.get(acct, Decimal(0))),
        }
        rows = [open_row] + rows

    # Solde global (toutes lignes filtrées)
    closing_balance = float(total_debit - total_credit)

    return {
        "success": True,
        "data": {
            "entries": rows,
            "totals": {
                "opening_balance": float(opening_balance_total),
                "debit": float(total_debit),
                "credit": float(total_credit),
                "closing_balance": closing_balance,
            },
            "total_count": total_count,
            "current_page": (offset // limit) + 1,
        },
    }


@frappe.whitelist()
def get_accounts_by_company(company: str):
    """Retourne les comptes (non group) pour une société donnée."""
    if not company:
        return {"success": True, "data": []}
    accounts = frappe.get_all(
        "Account",
        filters={"company": company, "is_group": 0},
        fields=["name", "account_name", "company", "root_type"],
        order_by="name",
    )
    return {"success": True, "data": accounts}


@frappe.whitelist()
def get_unpaid_invoices(company: str | None = None, party_type: str | None = None, party: str | None = None,
                        limit: int = 50, offset: int = 0, order_by: str | None = None):
    """Liste des factures impayées (Sales/Purchase Invoice) pour un tiers.
    Args:
        company: filtre optionnel
        party_type: 'Customer' ou 'Supplier'
        party: nom du client/fournisseur
    """
    if not party_type or not party:
        return {"success": True, "data": {"invoices": [], "total_count": 0}}

    if party_type == "Customer":
        doctype = "Sales Invoice"
        party_field = "customer"
    elif party_type == "Supplier":
        doctype = "Purchase Invoice"
        party_field = "supplier"
    else:
        return {"success": True, "data": {"invoices": [], "total_count": 0}}

    conds = [f"docstatus = 1", f"{party_field} = %(party)s", "outstanding_amount > 0"]
    params = {"party": party}
    if company:
        conds.append("company = %(company)s")
        params["company"] = company

    order = order_by or "posting_date asc"

    total_count = frappe.db.sql(
        f"""SELECT COUNT(*) FROM `tab{doctype}` WHERE {' AND '.join(conds)}""",
        params,
    )[0][0]

    invoices = frappe.db.sql(
        f"""
        SELECT name, posting_date, due_date, grand_total, outstanding_amount, currency, company
        FROM `tab{doctype}`
        WHERE {' AND '.join(conds)}
        ORDER BY {order}
        LIMIT %(limit)s OFFSET %(offset)s
        """,
        {**params, "limit": int(limit or 50), "offset": int(offset or 0)},
        as_dict=True,
    )

    return {"success": True, "data": {"invoices": invoices, "total_count": total_count}}
