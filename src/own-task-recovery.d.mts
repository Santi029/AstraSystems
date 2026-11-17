export function createOwnTaskRecovery(options: any): { pending(): any; submit(input: any): Promise<any>; recover(): Promise<any>; close(): void };
