export function stripNulls(obj: any): any {
	return Object.fromEntries(
		Object.entries(obj).filter(([key, value]) => value != null),
	);
}
