import { HttpInterceptorFn } from '@angular/common/http';

// CSRF protection is disabled on the backend (stateless JWT API — no session cookies).
export const csrfInterceptor: HttpInterceptorFn = (request, next) => next(request);