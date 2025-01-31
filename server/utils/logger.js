import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';

// Custom format configurations
const customFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.json(),  // Convert logs to JSON format
    winston.format.printf((info) => {
        // Basic message with timestamp and level
        const base = `${info.timestamp} [${info.level.toUpperCase()}]: ${info.message}`;

        // If there's metadata, append it
        if (Object.keys(info).length > 3) {  // More than timestamp, level, and message
            const meta = { ...info };
            // Remove default properties
            delete meta.timestamp;
            delete meta.level;
            delete meta.message;

            // Return message with metadata
            return `${base} | metadata: ${JSON.stringify(meta)}`;
        }

        return base;
    })
);

// Console specific format (with colors)
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

// Create logs directory if it doesn't exist
const logsDir = path.join(process.cwd(), 'logs');
const errorLogsDir = path.join(logsDir, 'errors');

// Configure file rotation transports
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

// Configure console transport
const consoleTransport = new winston.transports.Console({
    format: consoleFormat
});

// Create environment-specific transports
const getTransports = () => {
    const transports = [];

    // Production: Only file transports
    if (process.env.NODE_ENV === 'production') {
        transports.push(combinedFileTransport);
        transports.push(errorFileTransport);
    }
    // Development: Console transport only
    else {
        transports.push(consoleTransport);
        transports.push(combinedFileTransport);
        transports.push(errorFileTransport);
    }

    return transports;
};

// Create and configure the logger
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    transports: getTransports()
});

// Add error handling for the file transports
[combinedFileTransport, errorFileTransport].forEach(transport => {
    transport.on('error', (error) => {
        console.error('Error writing to log file:', error);
    });
});

// Utility method to handle uncaught exceptions
process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    process.exit(1);
});

// Utility method to handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

export default logger;