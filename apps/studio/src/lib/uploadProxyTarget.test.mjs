import assert from 'node:assert/strict';
import test from 'node:test';
import { validateUploadProxyTarget } from './uploadProxyTarget.mjs';

test('accepts standard S3 upload targets', () => {
    const targets = [
        'https://s3.amazonaws.com/example-bucket',
        'https://s3.us-east-1.amazonaws.com/example-bucket',
        'https://example-bucket.s3.amazonaws.com/upload',
        'https://example-bucket.s3.eu-west-1.amazonaws.com/upload?X-Amz-Signature=abc',
        'https://example-bucket.s3.dualstack.eu-west-1.amazonaws.com/upload',
        'https://example-bucket.s3-accelerate.amazonaws.com/upload',
    ];

    for (const target of targets) {
        assert.equal(validateUploadProxyTarget(target).ok, true, target);
    }
});

test('rejects SSRF and look-alike targets', () => {
    const targets = [
        'http://example-bucket.s3.amazonaws.com/upload',
        'https://127.0.0.1/upload',
        'https://localhost/upload',
        'https://169.254.169.254/latest/meta-data',
        'https://s3.amazonaws.com.evil.example/upload',
        'https://amazonaws.com/upload',
        'https://ec2.us-east-1.amazonaws.com/',
        'https://user:pass@example-bucket.s3.amazonaws.com/upload',
        'https://example-bucket.s3.amazonaws.com:444/upload',
        'https://example-bucket.s3.amazonaws.com/upload#fragment',
        'not a url',
    ];

    for (const target of targets) {
        assert.equal(validateUploadProxyTarget(target).ok, false, target);
    }
});

test('accepts only exact configured additional hosts', () => {
    const previous = process.env.UPLOAD_PROXY_ALLOWED_HOSTS;
    process.env.UPLOAD_PROXY_ALLOWED_HOSTS = 'uploads.example.com, media.example.net';

    try {
        assert.equal(validateUploadProxyTarget('https://uploads.example.com/form').ok, true);
        assert.equal(validateUploadProxyTarget('https://sub.uploads.example.com/form').ok, false);
        assert.equal(validateUploadProxyTarget('https://uploads.example.com.evil.test/form').ok, false);
    } finally {
        if (previous === undefined) delete process.env.UPLOAD_PROXY_ALLOWED_HOSTS;
        else process.env.UPLOAD_PROXY_ALLOWED_HOSTS = previous;
    }
});
