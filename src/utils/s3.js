const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");

const s3 = new S3Client({
  region: process.env.S3_REGION,
  endpoint: process.env.S3_ENDPOINT,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY,
    secretAccessKey: process.env.S3_SECRET_KEY,
  },
  forcePathStyle: true, // WAJIB untuk Biznet Neo Object Storage
});

async function uploadToS3({ buffer, filename, mimetype }) {
  const key = `uploads/${Date.now()}-${filename}`;

  await s3.send(
    new PutObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: mimetype,
    })
  );

  const url = `${process.env.S3_PUBLIC_BASE}/${key}`;
  return { key, url };
}

module.exports = { uploadToS3 };
