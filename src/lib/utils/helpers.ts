import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export const formatCurrency = (value: number, locale: string): string => {
    const result = new Intl.NumberFormat(locale, {
        maximumFractionDigits: 2,
    }).format(value);

    return result;
};

export const capitalize = (str: string) => {
    return str.charAt(0).toUpperCase() + str.slice(1);
};
