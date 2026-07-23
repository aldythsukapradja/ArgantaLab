const MAX_TARGET_LENGTH = 8_192;

/**
 * Exact extra upload hosts may be configured for a future storage provider.
 * Wildcards are deliberately unsupported so an environment typo cannot widen
 * the proxy to an attacker-controlled domain.
 */
function configuredHosts() {
    return new Set(
        (process.env.UPLOAD_PROXY_ALLOWED_HOSTS || '')
            .split(',')
            .map((host) => host.trim().toLowerCase())
            .filter(Boolean)
    );
}

function isDnsLabel(value) {
    return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(value);
}

function isAwsRegion(value) {
    return /^[a-z]{2}(?:-gov)?-[a-z0-9-]+-\d$/i.test(value);
}

/**
 * Accept the documented virtual-hosted and path-style AWS S3 endpoint forms,
 * including dual-stack and accelerate endpoints. This intentionally does not
 * accept arbitrary *.amazonaws.com services.
 */
function isAmazonS3Host(hostname) {
    const labels = hostname.split('.');

    // s3.amazonaws.com and <bucket>.s3.amazonaws.com
    if (hostname === 's3.amazonaws.com') return true;
    if (labels.length === 4 && labels[1] === 's3' &&
        labels[2] === 'amazonaws' && labels[3] === 'com') {
        return isDnsLabel(labels[0]);
    }

    // s3.<region>.amazonaws.com and <bucket>.s3.<region>.amazonaws.com
    if (labels.length === 4 && labels[0] === 's3' && isAwsRegion(labels[1]) &&
        labels[2] === 'amazonaws' && labels[3] === 'com') {
        return true;
    }
    if (labels.length === 5 && isDnsLabel(labels[0]) && labels[1] === 's3' &&
        isAwsRegion(labels[2]) && labels[3] === 'amazonaws' && labels[4] === 'com') {
        return true;
    }

    // Legacy s3-<region>.amazonaws.com forms.
    if (labels.length === 3 && labels[0].startsWith('s3-') &&
        isAwsRegion(labels[0].slice(3)) && labels[1] === 'amazonaws' && labels[2] === 'com') {
        return true;
    }
    if (labels.length === 4 && isDnsLabel(labels[0]) && labels[1].startsWith('s3-') &&
        isAwsRegion(labels[1].slice(3)) && labels[2] === 'amazonaws' && labels[3] === 'com') {
        return true;
    }

    // <bucket>.s3.dualstack.<region>.amazonaws.com
    if (labels.length === 6 && isDnsLabel(labels[0]) && labels[1] === 's3' &&
        labels[2] === 'dualstack' && isAwsRegion(labels[3]) &&
        labels[4] === 'amazonaws' && labels[5] === 'com') {
        return true;
    }

    // <bucket>.s3-accelerate[.dualstack].amazonaws.com
    if (labels.length === 4 && isDnsLabel(labels[0]) && labels[1] === 's3-accelerate' &&
        labels[2] === 'amazonaws' && labels[3] === 'com') {
        return true;
    }
    return labels.length === 5 && isDnsLabel(labels[0]) &&
        labels[1] === 's3-accelerate' && labels[2] === 'dualstack' &&
        labels[3] === 'amazonaws' && labels[4] === 'com';
}

export function validateUploadProxyTarget(value) {
    if (typeof value !== 'string' || value.length === 0) {
        return { ok: false, reason: 'Upload target must be a non-empty URL' };
    }
    if (value.length > MAX_TARGET_LENGTH) {
        return { ok: false, reason: 'Upload target URL is too long' };
    }

    let url;
    try {
        url = new URL(value);
    } catch {
        return { ok: false, reason: 'Upload target is not a valid URL' };
    }

    if (url.protocol !== 'https:') {
        return { ok: false, reason: 'Upload target must use HTTPS' };
    }
    if (url.username || url.password) {
        return { ok: false, reason: 'Upload target credentials are not allowed' };
    }
    if (url.port) {
        return { ok: false, reason: 'Upload target must use the default HTTPS port' };
    }
    if (url.hash) {
        return { ok: false, reason: 'Upload target fragments are not allowed' };
    }

    const hostname = url.hostname.toLowerCase();
    if (!isAmazonS3Host(hostname) && !configuredHosts().has(hostname)) {
        return { ok: false, reason: 'Upload target host is not allowed' };
    }

    return { ok: true, url: url.toString() };
}
