export function getApiBase(hostname: string = window.location.hostname): string {
	if (["localhost", "127.0.0.1"].includes(hostname)) {
		return "http://localhost:3001"
	}
	return ""
}
