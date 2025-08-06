frappe.ui.LinkPreview = class {
	constructor() {
		this.LINK_CLASSES = 'a[data-doctype], input[data-fieldtype="Link"], .popover';
		this.setup_events();
	}

	setup_events() {
		$(document.body).on("mouseover", this.LINK_CLASSES, (e) => {
			this.element = $(e.currentTarget);
			if (!this.element.data('preview-shown')) {
				this.show_custom_preview(e);
			}
		});

		$(document.body).on("mouseout", this.LINK_CLASSES, (e) => {
			$(".custom-link-preview").remove();
		});
	}

	show_custom_preview(e) {
		let element = this.element;
		let doctype = element.attr('data-doctype');
		let name = frappe.utils.unescape_html(element.attr('data-name'));
		if (!doctype || !name) return;

		frappe.xcall('frappe.desk.link_preview.get_preview_data', {
			doctype,
			docname: name
		}).then(preview_data => {
			if (!preview_data) return;

			let $preview = $(`
				<div class="custom-link-preview">
					<div class="preview-header">
						<img src="${preview_data.preview_image || '/assets/frappe/images/default-avatar.png'}" class="preview-image" />
						<div class="preview-title">${preview_data.preview_title}</div>
					</div>
					<hr>
					<div class="preview-body">
						${Object.keys(preview_data).map(key => {
							if (!["preview_image", "preview_title", "name"].includes(key)) {
								return `<div><strong>${key}:</strong> ${preview_data[key]}</div>`;
							} else {
								return '';
							}
						}).join('')}
					</div>
				</div>
			`);

			$('body').append($preview);
			$preview.css({
				position: 'absolute',
				top: e.pageY + 10,
				left: e.pageX + 10,
				'z-index': 10000,
				display: 'block'
			});
		});
	}
};
