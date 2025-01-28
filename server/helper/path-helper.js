import path, { extname } from "node:path"

class Path {
    checkExtension(filePath, extensionName = ".mp3") {
        return extname(filePath).toLowerCase() === extensionName;
    }

    join(...args) {
        return path.join(...args);
    }

    getDir(filePath) {
        return path.dirname(filePath);
    }
}

export default new Path();