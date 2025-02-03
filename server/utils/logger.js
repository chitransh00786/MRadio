import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';

const customFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.json(),
    winston.format.printf((info) => {
        const base = `${info.timestamp} [${info.level.toUpperCase()}]: ${info.message}`;

        if (Object.keys(info).length > 3) { 
            const meta = { ...info };
            delete meta.timestamp;
            delete meta.level;
            delete meta.message;

            return `${base} | metadata: ${JSON.stringify(meta)}`;
        }

        return base;
    })
);

const consoleFormat = winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.printf((info) => {
        const base = `${info.timestamp} [${info.level}]: ${info.message}`;

        if (Object.keys(info).length > 3) {
            const meta = { ...info };
            delete meta.timestamp;
            delete meta.level;
            delete meta.message;
            return `${base} | metadata: ${JSON.stringify(meta, null, 2)}`;
        }

        return base;
    })
);

const logsDir = path.join(process.cwd(), 'logs');
const errorLogsDir = path.join(logsDir, 'errors');

const combinedFileTransport = new DailyRotateFile({
    dirname: logsDir,
    filename: '%DATE%-combined.log',
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize: '20m',
    maxFiles: '14d',
    format: customFormat
});

const errorFileTransport = new DailyRotateFile({
    dirname: errorLogsDir,
    filename: '%DATE%-error.log',
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize: '20m',
    maxFiles: '14d',
    level: 'error',
    format: customFormat
});

const consoleTransport = new winston.transports.Console({
    format: consoleFormat
});

const getTransports = () => {
    const transports = [];

    if (process.env.NODE_ENV === 'production') {
        transports.push(combinedFileTransport);
        transports.push(errorFileTransport);
    }
    else {
        transports.push(consoleTransport);
        transports.push(combinedFileTransport);
        transports.push(errorFileTransport);
    }

    return transports;
};

const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    transports: getTransports()
});

[combinedFileTransport, errorFileTransport].forEach(transport => {
    transport.on('error', (error) => {
        console.error('Error writing to log file:', error);
    });
});

process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

export default logger;