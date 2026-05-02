// Toast notification component
function showToast(message, type = 'info') {
  const toastContainer = document.createElement('div');
  const isMobile = window.innerWidth < 768;
  
  toastContainer.style.cssText = `
    position: fixed;
    ${isMobile ? 'bottom: 20px; left: 50%; transform: translateX(-50%);' : 'top: 20px; right: 20px;'}
    background: ${type === 'error' ? '#ef4444' : type === 'success' ? '#10b981' : '#3b82f6'};
    color: white;
    padding: 16px 24px;
    border-radius: 8px;
    box-shadow: 0 10px 25px rgba(0,0,0,0.2);
    font-size: 14px;
    font-weight: 500;
    z-index: 99999;
    animation: slideIn 0.3s ease-out;
    width: ${isMobile ? 'calc(100% - 40px)' : 'auto'};
    max-width: ${isMobile ? '90vw' : '400px'};
    word-wrap: break-word;
  `;
  toastContainer.textContent = message;
  document.body.appendChild(toastContainer);

  // Add animations if not already in document
  if (!document.getElementById('toast-animations-error-handler')) {
    const style = document.createElement('style');
    style.id = 'toast-animations-error-handler';
    style.textContent = `
      @keyframes slideIn {
        from { 
          transform: translateX(400px) translateY(0);
          opacity: 0; 
        }
        to { 
          transform: translateX(0) translateY(0);
          opacity: 1; 
        }
      }
      @keyframes slideOut {
        from { 
          transform: translateX(0) translateY(0);
          opacity: 1; 
        }
        to { 
          transform: translateX(400px) translateY(0);
          opacity: 0; 
        }
      }
      @media (max-width: 767px) {
        @keyframes slideIn {
          from { 
            transform: translateX(-50%) translateY(100px);
            opacity: 0; 
          }
          to { 
            transform: translateX(-50%) translateY(0);
            opacity: 1; 
          }
        }
        @keyframes slideOut {
          from { 
            transform: translateX(-50%) translateY(0);
            opacity: 1; 
          }
          to { 
            transform: translateX(-50%) translateY(100px);
            opacity: 0; 
          }
        }
      }
    `;
    document.head.appendChild(style);
  }

  // Auto remove after 3 seconds
  setTimeout(() => {
    toastContainer.style.animation = 'slideOut 0.3s ease-out';
    setTimeout(() => toastContainer.remove(), 300);
  }, 3000);
}

// Handle 401 Unauthorized errors
export function handleUnauthorized() {
  // Clear all auth-related data
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  
  // Show friendly message
  showToast('Your session has expired. Please sign in again.', 'error');
  
  // Dispatch event to trigger login modal globally
  setTimeout(() => {
    window.dispatchEvent(new CustomEvent('openAuthModal', { detail: { mode: 'login' } }));
  }, 300);
}

// Wrapper for API calls with error handling
export async function fetchWithErrorHandling(url, options = {}) {
  try {
    const response = await fetch(url, options);
    
    // Handle 401 Unauthorized
    if (response.status === 401) {
      handleUnauthorized();
      throw new Error('Unauthorized: Session expired');
    }
    
    return response;
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
}
