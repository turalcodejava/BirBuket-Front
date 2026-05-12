# Product API Examples (Frontend)

Bu sənəd admin paneldə məhsul əlavə etmə, yeniləmə və silmə üçün frontend-dən istifadə edilən endpoint-ləri və hazır request/response nümunələrini verir.

## Base URL

- Brauzer sorğuları: `axios` üçün `VITE_API_BASE_URL` (boş olsa nisbi `/api` → Vite `BACKEND_URL` proxy, default `http://localhost:8081`).
- Gateway üzərindən ədədi istifadə: eyni path `PATCH /api/product/{id}` — proxy hədəfini `.env` ilə Gateway-ə yönləndirin.
- Birbaşa **product-service** (lokal): məs. `http://localhost:8083/api/product/{id}` — yalnız Postman/curl ilə; frontend JWT ilə adətən Gateway istifadə edir.
- Product path: `/api/product`
- Tam nümunə URL: `http://localhost:8081/api/product`

## Gateway və product-service port

- **Gateway** ədədi işləndikdə əsas URL üçün `.env` / Vite-da `VITE_API_BASE_URL`-i gateway adresinə qoyun; sorğular `PATCH /api/product/{id}` ilə eyni yolu saxlayır.
- **Birbaşa product-service** (məs.: `localhost:8083`): eyni yol **`PATCH http://localhost:8083/api/product/{id}`** — `Authorization: Bearer <JWT>` (SecurityConfig tərəfindən PATCH üçün auth lazımdır).
- Lokal dev: `vite.config` proxy `/api` → `BACKEND_URL` (defolt `8081`). Portu öz backend-inizə uyğun dəyişin.

### Qismən PATCH — yalnız məhsul endirimi (`discountPercentage`)

Bədənədə yalnız dəyişəcəyiniz sahəni göndərmək kifayətdir:

```bash
curl -X PATCH "http://localhost:8081/api/product/101" \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"discountPercentage":15}'
```

Frontend: `productService.patchFields(productId, { discountPercentage: 15 })` — JSON gövdə və JWT header ilə `axios` tərəfindən göndərilir. Bu sahə DB-də saxlanılır və cavablarda görünür; qiyməti avtomatik endirməz.

## Response format

Uğurlu cavablar adətən `ApiResponse` formatında gəlir:

```json
{
  "success": true,
  "message": "success",
  "data": {}
}
```

## Backend auto-filled fields (create zamani)

Product create edilende backend terefde avtomatik doldurulan sahələr:

- `id` (DB identity)
- `slug` (backend-generated; ad + timestamp axini)
- `sku` (backend-generated)
- `createdAt` (`@CreationTimestamp`)
- `updatedAt` (`@UpdateTimestamp`)
- `images[].id` ve `productVariants[].id` (DB identity)
- `images[].imageUrl` (file upload olarsa backend URL yaradir)

Request-de gonderilmeyende backend default veren sahələr:

- `active = true`
- `isSingle = false`
- `rating = 0.0`
- `reviewCount = 0`
- `discountPercentage = 0` (mapper/flow-a gore null handling deyise biler)

## 1) Create Product

- Method: `POST`
- Endpoint: `/api/product`
- Content-Type: `multipart/form-data`
- Auth: `Authorization: Bearer <token>` (frontend header göndərir)

Frontend hazırda eyni JSON-u 3 fərqli açarla göndərir (`product`, `productRequest`, `data`) ki, fərqli backend contract-larını dəstəkləsin.

### cURL (multipart)

```bash
curl -X POST "http://localhost:8081/api/product" \
  -H "Authorization: Bearer <TOKEN>" \
  -F 'product={"productName":"Qirmizi Gul Buketi","description":"Premium 25 gul","productType":"FLOWER","productCategoryId":3,"productVariants":[{"price":79.9}]}' \
  -F 'productRequest={"productName":"Qirmizi Gul Buketi","description":"Premium 25 gul","productType":"FLOWER","productCategoryId":3,"productVariants":[{"price":79.9}]}' \
  -F 'data={"productName":"Qirmizi Gul Buketi","description":"Premium 25 gul","productType":"FLOWER","productCategoryId":3,"productVariants":[{"price":79.9}]}' \
  -F "images=@/absolute/path/image1.jpg" \
  -F "images=@/absolute/path/image2.jpg"
```

### Success response (example)

```json
{
  "success": true,
  "message": "Product created successfully",
  "data": {
    "id": 101,
    "productName": "Qirmizi Gul Buketi",
    "slug": "qirmizi-gul-buketi-1715155151000",
    "sku": "#1715155151000",
    "productType": "FLOWER",
    "active": true,
    "isSingle": false,
    "rating": 0.0,
    "reviewCount": 0
  }
}
```

## 2) Update Product (JSON)

- Method: `PATCH`
- Endpoint: `/api/product/{id}`
- Content-Type: `application/json`
- Auth: `Authorization: Bearer <token>`

### Qismən yeniləmə — yalnız endirim (minimum body)

Başqa sahələri göndərmədən yalnız dəyişmək istədiyinizi göndərin; backend əsasən saxlayır və cavablarda görünür (qiymət cəmi avtomatik endirməz).

```bash
curl -X PATCH "http://localhost:8081/api/product/101" \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"discountPercentage":15}'
```

Frontend: `productService.patchFields(id, { discountPercentage: 15 })` → eyni JSON `PATCH` (admin məhsullar cədvəli).

### Tam örnək cURL (json body — bir neçə sahə)

```bash
curl -X PATCH "http://localhost:8081/api/product/101" \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "productName": "Qirmizi Gul Buketi Deluxe",
    "description": "Premium 35 gul",
    "productType": "FLOWER",
    "productCategoryId": 3,
    "productVariants": [
      { "price": 99.9 }
    ]
  }'
```

Frontend fallback olaraq aşağıdakı JSON wrapper-ları da yoxlayır:

- `{ ...payload }`
- `{ "product": { ...payload } }`
- `{ "productRequest": { ...payload } }`
- `{ "data": { ...payload } }`

### Success response (example)

```json
{
  "success": true,
  "message": "Product updated successfully",
  "data": {
    "id": 101,
    "productName": "Qirmizi Gul Buketi Deluxe"
  }
}
```

## 3) Update Product (multipart + image)

- Method: `PATCH`
- Endpoint: `/api/product/{id}`
- Content-Type: `multipart/form-data`
- Auth: `Authorization: Bearer <token>`

Yeni şəkil əlavə ediləcəksə frontend bu variantdan istifadə edir.

### cURL (multipart)

```bash
curl -X PATCH "http://localhost:8081/api/product/101" \
  -H "Authorization: Bearer <TOKEN>" \
  -F 'product={"productName":"Qirmizi Gul Buketi Deluxe","description":"Yeni sekil ile update","productType":"FLOWER","productCategoryId":3,"productVariants":[{"price":109.9}]}' \
  -F 'productRequest={"productName":"Qirmizi Gul Buketi Deluxe","description":"Yeni sekil ile update","productType":"FLOWER","productCategoryId":3,"productVariants":[{"price":109.9}]}' \
  -F 'data={"productName":"Qirmizi Gul Buketi Deluxe","description":"Yeni sekil ile update","productType":"FLOWER","productCategoryId":3,"productVariants":[{"price":109.9}]}' \
  -F "images=@/absolute/path/new-image.jpg"
```

## 4) Delete Product

- Method: `DELETE`
- Endpoint: `/api/product/{id}`
- Auth: `Authorization: Bearer <token>`

### cURL

```bash
curl -X DELETE "http://localhost:8081/api/product/101" \
  -H "Authorization: Bearer <TOKEN>"
```

### Success response (example)

```json
{
  "success": true,
  "message": "Product deleted successfully",
  "data": null
}
```

## Frontend payload fields (minimum practical set)

- `productName` (string, bos olmamalidir)
- `description` (string)
- `productType` (string, backend enum ola biler)
- `productCategoryId` (number)
- `productVariants` (array; en azi bir elementde `price`)

Qeyd: `slug`, `sku`, `createdAt`, `updatedAt`, `rating`, `reviewCount`, `active` ve `isSingle` adeten backend terefde avtomatik set oluna bilir.

## Enum notes

Bu repo frontend terefde strict enum mecburiyyeti qoymur; deyerler backend contract-a gore verilir.

- `productType`: frontendde gorunen numuneler `FLOWER`, `OBVIOUSLY`
- `size`: variant sahesi stringdir (mes: `SMALL`, `MEDIUM`, `LARGE`)
- `color`: variant sahesi stringdir (mes: `RED`, `WHITE`, `PINK`, `YELLOW`)

## Validation notes (frontend practical)

- `productName` bos olarsa save edilmir
- `price` reqem olmalidir; variantda `price <= 0` olanda save edilmir
- `discountPercentage` ve `rating` create/update payload-a mecburi gonderilmir (backend default/validation qaydasina tabedir)

## Source (kodda harada istifade olunur)

- `src/services/api.ts` -> `productService.create`
- `src/services/api.ts` -> `productService.update`
- `src/services/api.ts` -> `productService.patchFields` (qismən PATCH, məs. yalnız `discountPercentage`)
- `src/services/api.ts` -> `productService.remove`
- `src/components/Admin/AdminProducts.tsx` -> məhsul siyahısı; endirim % üçün `patchFields`
