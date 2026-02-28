/**
 * Validates a webhook URL and prevents SSRF attacks
 * @throws Error if URL is invalid or targets a private network
 */
export function validateWebhookUrl(urlString: string): void {
  // Basic format check
  if (!urlString || typeof urlString !== 'string') {
    throw new Error('Webhook URL is required');
  }

  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    throw new Error('Invalid URL format');
  }

  // Require HTTPS for security
  if (url.protocol !== 'https:') {
    throw new Error('Webhook URL must use HTTPS protocol');
  }

  // Prevent SSRF by blocking private IP ranges
  const hostname = url.hostname.toLowerCase();

  // Block localhost variants
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.startsWith('127.') ||
    hostname === '::1' ||
    hostname === '0.0.0.0'
  ) {
    throw new Error('Webhook URL cannot target localhost');
  }

  // Block private IPv4 ranges
  const ipv4Match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const octets = ipv4Match.slice(1, 5).map(Number);
    
    // 10.0.0.0/8
    if (octets[0] === 10) {
      throw new Error('Webhook URL cannot target private network (10.0.0.0/8)');
    }
    
    // 172.16.0.0/12
    if (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) {
      throw new Error('Webhook URL cannot target private network (172.16.0.0/12)');
    }
    
    // 192.168.0.0/16
    if (octets[0] === 192 && octets[1] === 168) {
      throw new Error('Webhook URL cannot target private network (192.168.0.0/16)');
    }
    
    // 169.254.0.0/16 (link-local)
    if (octets[0] === 169 && octets[1] === 254) {
      throw new Error('Webhook URL cannot target link-local address (169.254.0.0/16)');
    }
  }

  // Block .local domains (mDNS)
  if (hostname.endsWith('.local')) {
    throw new Error('Webhook URL cannot target .local domain');
  }

  // Block internal/private TLDs
  const internalTlds = ['.internal', '.localhost', '.test', '.example', '.invalid'];
  if (internalTlds.some(tld => hostname.endsWith(tld))) {
    throw new Error('Webhook URL cannot target internal domain');
  }
}

/**
 * Validates an email address format
 * @throws Error if email format is invalid
 */
export function validateEmail(email: string): void {
  if (!email || typeof email !== 'string') {
    throw new Error('Email address is required');
  }

  // Basic email regex - RFC 5322 simplified
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  if (!emailRegex.test(email)) {
    throw new Error('Invalid email address format');
  }

  // Additional checks
  if (email.length > 254) {
    throw new Error('Email address is too long');
  }
}
