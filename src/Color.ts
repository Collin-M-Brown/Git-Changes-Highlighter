export class Color {
    public r: number = 0;
    public g: number = 0;
    public b: number = 0;
    public a: number = 0;

    setColor(rgba: string) {
        if (!/rgba?\((\d{1,3}),\s*(\d{1,3}),\s*(\d{1,3}),\s*(\d*(?:\.\d+)?)\)/.test(rgba)) {
            return;
        }

        // Extract the individual r, g, b, a values
        const [r, g, b, a] = rgba.match(/(\d+(?:\.\d+)?)/g)!;

        this.r = parseInt(r);
        this.g = parseInt(g);
        this.b = parseInt(b);
        this.a = parseFloat(a);
    }

    constructor(rgba: string) {
        this.setColor(rgba);
    }

    toString(): string {
        return `rgba(${this.r},${this.g},${this.b},${this.a})`;
    }

    toStringO(opacity: number): string {
        return `rgba(${this.r},${this.g},${this.b},${opacity})`;
    }
}
