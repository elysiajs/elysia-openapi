class HtmlFragment {
	constructor(readonly value: string) {}
}

const fragment = (value: string) => new HtmlFragment(value)

function escapeHtml(value: unknown) {
	const text = String(value)

	if (typeof Bun !== 'undefined' && typeof Bun.escapeHTML === 'function')
		return Bun.escapeHTML(text)

	return text.replace(/[&<>"']/g, (character) => {
		switch (character) {
			case '&':
				return '&amp;'

			case '<':
				return '&lt;'

			case '>':
				return '&gt;'

			case '"':
				return '&quot;'

			default:
				return '&#39;'
		}
	})
}

export function html(
	strings: TemplateStringsArray,
	...values: unknown[]
) {
	let result = strings[0]

	for (let index = 0; index < values.length; index++) {
		const value = values[index]
		result += value instanceof HtmlFragment ? value.value : escapeHtml(value)
		result += strings[index + 1]
	}

	return fragment(result)
}

export const renderHtml = (value: HtmlFragment) => value.value

export function jsonForScript(value: unknown) {
	const serialized = JSON.stringify(value)
	if (serialized === undefined) throw new TypeError('Expected JSON data')

	return fragment(serialized.replace(/</g, '\\u003c'))
}

export const styleElement = (css: string) =>
	fragment(`<style>\n      ${css.replace(/</g, '\\00003c')}\n    </style>`)
