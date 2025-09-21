import { declarationToJSONSchema } from '../src/gen'

console.log(
	declarationToJSONSchema(`{
		"hello-world": {
			2: {
				get: {
					params: { }
					query: { }
					headers: { }
					body: { }
					response: {
						200: {
							name: string
						}
					}
				}
			}
		}
	}`)
)
