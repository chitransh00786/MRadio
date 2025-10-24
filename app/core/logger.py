import logging
import json
import os
from datetime import datetime
from logging.handlers import TimedRotatingFileHandler
from pathlib import Path

class CircularReferenceFilter(logging.Filter):
    def filter(self, record):
        if hasattr(record, 'metadata'):
            record.metadata = self._handle_circular(record.metadata)
        return True
    
    def _handle_circular(self, obj, seen=None):
        if seen is None:
            seen = set()
        
        if id(obj) in seen:
            return "[Circular]"
        
        if isinstance(obj, (str, int, float, bool, type(None))):
            return obj
        
        seen.add(id(obj))
        
        if isinstance(obj, dict):
            return {k: self._handle_circular(v, seen) for k, v in obj.items()}
        elif isinstance(obj, (list, tuple)):
            return [self._handle_circular(item, seen) for item in obj]
        
        seen.discard(id(obj))
        return str(obj)

class CustomFormatter(logging.Formatter):
    def format(self, record):
        timestamp = datetime.fromtimestamp(record.created).strftime('%Y-%m-%d %H:%M:%S')
        level = record.levelname
        message = record.getMessage()
        
        base = f"{timestamp} [{level}]: {message}"
        
        if hasattr(record, 'metadata') and record.metadata:
            metadata_str = json.dumps(record.metadata, indent=2)
            return f"{base} | metadata: {metadata_str}"
        
        return base

class ColoredFormatter(CustomFormatter):
    COLORS = {
        'DEBUG': '\033[36m',
        'INFO': '\033[32m',
        'WARNING': '\033[33m',
        'ERROR': '\033[31m',
        'CRITICAL': '\033[35m',
    }
    RESET = '\033[0m'
    
    def format(self, record):
        levelname = record.levelname
        if levelname in self.COLORS:
            record.levelname = f"{self.COLORS[levelname]}{levelname}{self.RESET}"
        return super().format(record)

def setup_logger():
    logs_dir = Path('logs')
    error_logs_dir = logs_dir / 'errors'
    logs_dir.mkdir(exist_ok=True)
    error_logs_dir.mkdir(exist_ok=True)
    
    logger = logging.getLogger('mradio')
    logger.setLevel(os.getenv('LOG_LEVEL', 'INFO'))
    logger.addFilter(CircularReferenceFilter())
    
    handlers = []
    
    if os.getenv('NODE_ENV') == 'production':
        combined_handler = TimedRotatingFileHandler(
            logs_dir / 'combined.log',
            when='midnight',
            interval=1,
            backupCount=4
        )
        combined_handler.setFormatter(CustomFormatter())
        handlers.append(combined_handler)
        
        error_handler = TimedRotatingFileHandler(
            error_logs_dir / 'error.log',
            when='midnight',
            interval=1,
            backupCount=4
        )
        error_handler.setLevel(logging.ERROR)
        error_handler.setFormatter(CustomFormatter())
        handlers.append(error_handler)
    else:
        console_handler = logging.StreamHandler()
        console_handler.setFormatter(ColoredFormatter())
        handlers.append(console_handler)
        
        combined_handler = TimedRotatingFileHandler(
            logs_dir / 'combined.log',
            when='midnight',
            interval=1,
            backupCount=4
        )
        combined_handler.setFormatter(CustomFormatter())
        handlers.append(combined_handler)
        
        error_handler = TimedRotatingFileHandler(
            error_logs_dir / 'error.log',
            when='midnight',
            interval=1,
            backupCount=4
        )
        error_handler.setLevel(logging.ERROR)
        error_handler.setFormatter(CustomFormatter())
        handlers.append(error_handler)
    
    for handler in handlers:
        logger.addHandler(handler)
    
    return logger

logger = setup_logger()

def log_with_metadata(level, message, **metadata):
    log_record = logger.makeRecord(
        logger.name, level, "", 0, message, (), None
    )
    log_record.metadata = metadata
    logger.handle(log_record)

def info(message, **metadata):
    if metadata:
        log_with_metadata(logging.INFO, message, **metadata)
    else:
        logger.info(message)

def error(message, **metadata):
    if metadata:
        log_with_metadata(logging.ERROR, message, **metadata)
    else:
        logger.error(message)

def warning(message, **metadata):
    if metadata:
        log_with_metadata(logging.WARNING, message, **metadata)
    else:
        logger.warning(message)

def debug(message, **metadata):
    if metadata:
        log_with_metadata(logging.DEBUG, message, **metadata)
    else:
        logger.debug(message)

def warn(message, **metadata):
    warning(message, **metadata)
