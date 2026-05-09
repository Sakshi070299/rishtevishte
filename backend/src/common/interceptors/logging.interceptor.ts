import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import * as crypto from 'crypto';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const { method, url } = request;

    // Generate or reuse correlation ID
    const correlationId =
      request.headers['x-correlation-id'] || crypto.randomUUID();
    request.correlationId = correlationId;

    // Set correlation ID on response
    const response = context.switchToHttp().getResponse();
    response.header('x-correlation-id', correlationId);

    const start = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - start;
          const status = response.statusCode;
          // Log requests slower than 500ms or all in development
          if (duration > 500 || process.env.NODE_ENV === 'development') {
            console.log(
              `[${correlationId}] ${method} ${url} ${status} ${duration}ms`,
            );
          }
        },
        error: (err) => {
          const duration = Date.now() - start;
          const status = err?.status || 500;
          console.error(
            `[${correlationId}] ${method} ${url} ${status} ${duration}ms - ${err?.message || err}`,
          );
        },
      }),
    );
  }
}
