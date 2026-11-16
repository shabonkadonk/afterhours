-- Give high-resolution guest camera captures room to retain JPEG detail.
update storage.buckets
set file_size_limit = 10485760
where id = 'roll-photos';
