export class AppError extends Error {
  constructor(message: string, public readonly code = 'APP_ERROR', public readonly details?: string[]) {
    super(message);
    this.name = 'AppError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details: string[]) {
    super(message, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

export class RepositoryError extends AppError {
  constructor(message: string, code = 'REPOSITORY_ERROR') {
    super(message, code);
    this.name = 'RepositoryError';
  }
}
