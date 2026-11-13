export default interface StreamHandlers {
    onBinary?: (chunk: Buffer) => any | Promise<any>,
    onMessage?: (data: any) => any | Promise<any>,
    onClose?: (code: number) => any | Promise<any>
}
