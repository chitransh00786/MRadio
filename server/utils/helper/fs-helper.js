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
        try {
            fs.renameSync(oldPath, newPath);
            return true;
        } catch (error) {
            // If rename fails (e.g., across devices), try copy+delete
            this.copy(oldPath, newPath);
            this.delete(oldPath);
            return true;
        }
    }

    copy(sourcePath, destinationPath) {
        try {
            fs.copyFileSync(sourcePath, destinationPath);
            return true;
        } catch (error) {
            throw new Error(`Failed to copy file from ${sourcePath} to ${destinationPath}: ${error.message}`);
        }
    }

    listFiles(directoryPath) {
        if(!this.exists(directoryPath)){
            this.createDirectory(directoryPath);
        }
        return fs.readdirSync(directoryPath);
    }
}

export default new FS();
