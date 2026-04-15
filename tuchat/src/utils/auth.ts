import { Platform } from 'react-native';

const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';

// Función para decodificar una cadena Base64, utilizada como parte de la decodificación de JWT en entornos donde atob no está disponible (como React Native).
export const atobPolyfill = (input: string = '') => {
    const str = input.replace(/=+$/, '');
    let output = '';

    if (str.length % 4 == 1) {
        throw new Error("'atob' failed: The string to be decoded is not correctly encoded.");
    }
    for (
        let bc = 0, bs = 0, buffer, i = 0;
        (buffer = str.charAt(i++));
        ~buffer && ((bs = bc % 4 ? bs * 64 + buffer : buffer), bc++ % 4)
            ? (output += String.fromCharCode(255 & (bs >> ((-2 * bc) & 6))))
            : 0
    ) {
        buffer = chars.indexOf(buffer);
    }

    return output;
};

// Función para decodificar un JWT, extrayendo su payload y convirtiéndolo a un objeto JavaScript. Utiliza atob o una función polyfill para decodificar la parte del payload del token.
export const decodeJwt = (token: string) => {
    try {
        const base64Url = token.split('.')[1];
        let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');

        // Add padding if needed for strict atob
        while (base64.length % 4) {
            base64 += '=';
        }

        // Use window.atob if available (web), otherwise polyfill
        const decodedStr = (typeof atob !== 'undefined')
            ? atob(base64)
            : atobPolyfill(base64);

        const jsonPayload = decodeURIComponent(
            decodedStr.split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')
        );
        return JSON.parse(jsonPayload);
    } catch (e) {
        console.error("Error decoding JWT:", e);
        return null;
    }
};
