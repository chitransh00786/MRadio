import fs from "node:fs";
import pathHelper from "./path-helper.js";

class FS {
    readFromJson(filePath, emptyDataStructure = []) {
        if (!this.exists(filePath)) {
            this.writeToJson(filePath, emptyDataStructure);
        }
        const data = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(data);
    }

    writeToJson(filePath, data) {
        const directoryPath = pathHelper.getDir(filePath);
        if (!this.exists(directoryPath)) {
            this.createDirectory(directoryPath);
        }
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        return true;
    }

    exists(filePath) {
        return fs.existsSync(filePath);
    }

    delete(filePath) {
        fs.unlinkSync(filePath);
        return true;
    }

    createDirectory(directoryPath) {
        fs.mkdirSync(directoryPath, { recursive: true });
        return true;
    }

    rename(oldPath, newPath) {
        fs.renameSync(oldPath, newPath);
        return true;
    }

    listFiles(directoryPath) {
        if(!this.exists(directoryPath)){
            this.createDirectory(directoryPath);
        }
        return fs.readdirSync(directoryPath);
    }
}

export default new FS();