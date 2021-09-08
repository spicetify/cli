class Utils {
    static addQueueListener(callback) {
        Spicetify.Player.origin2.state.addQueueListener(callback);
    }

    static removeQueueListener(callback) {
        Spicetify.Player.origin2.state.queueListeners =
          Spicetify.Player.origin2.state.queueListeners.filter(v => v != callback);
    }

    static convertIntToRGB(colorInt, div = 1) {
        const rgb = {
            r: Math.round(((colorInt >> 16) & 0xff) / div),
            g: Math.round(((colorInt >> 8) & 0xff) / div),
            b: Math.round((colorInt & 0xff) / div),
        };
        return `rgb(${rgb.r},${rgb.g},${rgb.b})`
    }

    static normalize(s, emptySymbol = true) {
        const result = s
            .replace(/（/g, '(')
            .replace(/）/g, ')')
            .replace(/【/g, '[')
            .replace(/】/g, ']')
            .replace(/。/g, '. ')
            .replace(/；/g, '; ')
            .replace(/：/g, ': ')
            .replace(/？/g, '? ')
            .replace(/！/g, '! ')
            .replace(/、|，/g, ', ')
            .replace(/‘|’|′|＇/g, "'")
            .replace(/“|”/g, '"')
            .replace(/〜/g, '~')
            .replace(/·|・/g, '•');
        if (emptySymbol) {
            result.replace(/-/g, ' ').replace(/\//g, ' ');
        }
        return result.replace(/\s+/g, ' ').trim();
    }

    static removeSongFeat(s) {
        return (
            s
            .replace(/-\s+(feat|with).*/i, '')
            .replace(/(\(|\[)(feat|with)\.?\s+.*(\)|\])$/i, '')
            .trim() || s
        );
    }

    static removeExtraInfo(s) {
        return (
            s
            .replace(/\s-\s.*/, "")
        )
    }

    static capitalize(s) {
        return s.replace(/^(\w)/, ($1) => $1.toUpperCase());
    }
}