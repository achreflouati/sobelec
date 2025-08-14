frappe.pages['saisir_reglement_by_ciel'].on_page_load = function(wrapper) {
	var page = frappe.ui.make_app_page({
		parent: wrapper,
		title: __('Saisie des règlements'),
		single_column: true
	});

	frappe.require(['saisir_reglement_by_ciel.bundle.js'], () => {
		new frappe.saisir_reglement_by_ciel.SaisirReglementManager(page);
	});
};
