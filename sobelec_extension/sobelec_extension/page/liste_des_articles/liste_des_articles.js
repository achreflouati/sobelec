frappe.pages['liste-des-articles'].on_page_load = function(wrapper) {
	let page = frappe.ui.make_app_page({
		parent: wrapper,
		title: 'Liste des Articles',
		single_column: true
	});

	let $container = $(`
		<div>
			<div id="custom-columns" style="margin-bottom: 10px;"></div>
			<div id="custom-table" style="margin-top: 20px;"></div>
		</div>
	`).appendTo(page.body);

	// Colonnes initiales par défaut
	let columns = [
		{ label: 'Code', fieldname: 'name', width: 120 },
		{ label: 'Nom', fieldname: 'item_name', width: 200 },
		{ label: 'Description', fieldname: 'description', width: 250 },
		{ label: 'Prix Unitaire', fieldname: 'standard_rate', width: 120 },
		{ label: 'Unité de Mesure', fieldname: 'stock_uom', width: 100 },
		{ label: 'Catégorie', fieldname: 'item_group', width: 150 },
		{ label: 'Fournisseur Principal', fieldname: 'default_supplier', width: 150 },
		{ label: 'Stock Réel', fieldname: 'stock_reel', width: 120 }
	];

	let item_fields = [];  // liste des champs disponibles
	let dt;               // variable pour le DataTable

	// Fonction pour afficher le tableau avec les données
	function render_table(data) {
		if (dt) dt.destroy();
		dt = new DataTable('#custom-table', {
			columns: columns,
			data: data,
			checkboxColumn: true,
			inlineFilters: true,
			layout: 'fixed'
		});
	}

	// Fonction pour récupérer les données depuis l'API custom
	function fetch_data() {
		frappe.call({
			method: 'sobelec_extension.get_item_field1.get_item_fields',
			args: {
				fields: JSON.stringify(columns.map(col => col.fieldname)),
				limit: 50,
				start: 0
			},
			callback: function(r) {
				render_table(r.message);
			}
		});
	}

	// Charger la liste des champs existants dans Item (pour le prompt)
	frappe.call({
		method: 'sobelec_extension.get_item_field1.get_custom_item_list',
		callback: function(r) {
			
			if(r.message) {
				item_fields = r.message;
				console.log('item_fields:', item_fields);
			}
		}
	});

	// Bouton Ajouter Colonne avec dropdown des champs disponibles
	$(`<button class="btn btn-primary btn-sm">Ajouter Colonne</button>`)
		.appendTo('#custom-columns')
		.on('click', function() {
		let options = item_fields.map(f => f.fieldname).join('\n');
			

			frappe.prompt([
				{
					label: 'Nom du Champ (fieldname)',
					fieldname: 'fieldname',
					fieldtype: 'Select',
					options: options,
					reqd: 1
				},
				{
					label: 'Label',
					fieldname: 'label',
					fieldtype: 'Data',
				},
				{
					label: 'Largeur (px)',
					fieldname: 'width',
					fieldtype: 'Int',
					default: 100
				}
			], function(values) {
				let fieldname = values.fieldname.split(':')[0]; // extraire le fieldname

				columns.push({
					label: values.label || fieldname,
					fieldname: fieldname,
					width: values.width || 100
				});

				fetch_data();
			}, 'Ajouter Colonne');
		});

	fetch_data();
};
