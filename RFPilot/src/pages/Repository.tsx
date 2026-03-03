import { useState, useEffect, useRef } from "react";
import { useUser } from '@clerk/clerk-react';
import Papa from "papaparse";
import { MainLayout } from "@/components/layout/MainLayout";
import { useT } from "@/hooks/useT";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Plus,
  Database,
  DollarSign,
  Eye,
  Pencil,
  Trash2,
  Upload,
  Download,
} from "lucide-react";

const API = (import.meta.env.VITE_API_URL || 'http://localhost:5000') + '/api/products';
const TESTING_API = (import.meta.env.VITE_API_URL || 'http://localhost:5000') + '/api/testing-matrix';

export default function Repository() {
  const { t, registerText, lang } = useT();
  const [products, setProducts] = useState<any[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [editProduct, setEditProduct] = useState<any | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const [skuCode, setSkuCode] = useState("");
  const [productName, setProductName] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [customFields, setCustomFields] = useState<{ key: string; value: string }[]>([]);

  // Testing Matrix State
  const [testingMatrix, setTestingMatrix] = useState<any[]>([]);
  const [editTest, setEditTest] = useState<any | null>(null);
  const [showAddTestDialog, setShowAddTestDialog] = useState(false);
  const [testCode, setTestCode] = useState("");
  const [testName, setTestName] = useState("");
  const [standardRef, setStandardRef] = useState("");
  const [testCategory, setTestCategory] = useState("");
  const [testPrice, setTestPrice] = useState("");
  const [priceBasis, setPriceBasis] = useState("");

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const getAuthHeaders = () => {
    const token = localStorage.getItem("token");
    const headers: Record<string,string> = { "Content-Type": "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
  };

  const loadProducts = () => {
    fetch(API, { headers: getAuthHeaders() })
      .then((res) => res.json())
      .then((data) => {
        setProducts(data || []);
        try {
          (data || []).forEach((p: any) => {
            registerText && registerText(`Repository.product.${p._id}.sku`, p.sku_code || "");
            registerText && registerText(`Repository.product.${p._id}.name`, p.product_name || "");
            registerText && registerText(`Repository.product.${p._id}.price`, String(p.unit_price_inr || ""));
            // register extra fields
            Object.keys(p).forEach((k) => {
              if (!["_id","sku_code","product_name","unit_price_inr","__v"].includes(k)) {
                registerText && registerText(`Repository.product.${p._id}.field.${k}`, String(p[k] || ""));
              }
            });
          });
        } catch (e) {}
      })
      .catch(console.error);
  };

  const loadTestingMatrix = () => {
    fetch(TESTING_API, { headers: getAuthHeaders() })
      .then((res) => res.json())
      .then((data) => {
        setTestingMatrix(data || []);
        try {
          (data || []).forEach((testItem: any) => {
            registerText && registerText(`Repository.test.${testItem._id}.code`, testItem.test_code || "");
            registerText && registerText(`Repository.test.${testItem._id}.name`, testItem.test_name || "");
            registerText && registerText(`Repository.test.${testItem._id}.standard`, testItem.standard_reference || "");
            registerText && registerText(`Repository.test.${testItem._id}.category`, testItem.test_category || "");
            registerText && registerText(`Repository.test.${testItem._id}.price`, String(testItem.price_inr || ""));
          });
        } catch (e) {}
      })
      .catch(console.error);
  };

  const localizeDigits = (v: string | number | undefined | null) => {
    if (v === undefined || v === null) return "";
    const s = String(v);
    if (!lang || (lang !== 'hi' && lang !== 'mr')) return s;
    const map: Record<string,string> = { '0':'०','1':'१','2':'२','3':'३','4':'४','5':'५','6':'६','7':'७','8':'८','9':'९' };
    return s.replace(/[0-9]/g, d => map[d] || d);
  }

  const formatCurrency = (v: number | undefined | null) => {
    if (v === undefined || v === null) return "₹0";
    const s = `₹${v.toLocaleString('en-IN')}`;
    if (!lang || (lang !== 'hi' && lang !== 'mr')) return s;
    return localizeDigits(s);
  }

  useEffect(() => {
    loadProducts();
    loadTestingMatrix();
  }, []);

  // Determine role (Clerk first, fallback to localStorage)
  const { user } = useUser();
  const getUserRole = () => {
    let roleVal: any = "";
    if (user && ((user as any).publicMetadata || (user as any).public_metadata)) {
      const meta = (user as any).publicMetadata || (user as any).public_metadata || {};
      if (meta.role) roleVal = meta.role;
      else if (meta.roles) roleVal = meta.roles;
    } else {
      try {
        const stored = localStorage.getItem('user');
        if (stored) roleVal = JSON.parse(stored).role || "";
      } catch {}
    }
    if (Array.isArray(roleVal)) return roleVal.join(',');
    return String(roleVal || "");
  };

  const normalizeRole = (r: string) => r ? r.toLowerCase().replace(/[_\s]/g, '') : '';
  const hasAnyRole = (...roles: string[]) => {
    const cur = normalizeRole(getUserRole());
    return roles.some(r => cur.includes(normalizeRole(r)));
  };

  const currentRole = getUserRole();

  const filteredProducts = products.filter(
    (p) =>
      p.sku_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.product_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getExtraFields = (product: any) => {
    const ignore = ["_id", "__v", "sku_code", "product_name", "unit_price_inr"];
    return Object.entries(product).filter(([k]) => !ignore.includes(k));
  };

  const resetForm = () => {
    setSkuCode("");
    setProductName("");
    setUnitPrice("");
    setCustomFields([]);
    setShowAddDialog(false);
  };

  const resetTestForm = () => {
    setTestCode("");
    setTestName("");
    setStandardRef("");
    setTestCategory("");
    setTestPrice("");
    setPriceBasis("");
    setShowAddTestDialog(false);
  };

  // ---------------- ACTIONS ----------------

  const saveProduct = async () => {
    if (!skuCode || !productName || !unitPrice) {
      alert("Mandatory fields missing");
      return;
    }
    const payload: any = {
      sku_code: skuCode,
      product_name: productName,
      unit_price_inr: Number(unitPrice),
    };
    customFields.forEach((f) => f.key && (payload[f.key] = f.value));

    await fetch(API, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    resetForm();
    loadProducts();
  };

  const updateProduct = async () => {
    const payload: any = {
      sku_code: skuCode,
      product_name: productName,
      unit_price_inr: Number(unitPrice),
    };
    customFields.forEach((f) => f.key && (payload[f.key] = f.value));

    await fetch(`${API}/${editProduct._id}`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    resetForm();
    setEditProduct(null);
    loadProducts();
  };

  const deleteProduct = async (id: string) => {
    if (!confirm("Delete this product permanently?")) return;
    await fetch(`${API}/${id}`, { method: "DELETE", headers: getAuthHeaders() });
    loadProducts();
  };

  // ---------------- TESTING MATRIX ACTIONS ----------------

  const saveTest = async () => {
    if (!testCode || !testName || !testPrice) {
      alert("Test Code, Name, and Price are required");
      return;
    }
    const payload = {
      test_code: testCode,
      test_name: testName,
      standard_reference: standardRef,
      test_category: testCategory,
      price_inr: Number(testPrice),
      price_basis: priceBasis,
    };

    await fetch(TESTING_API, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    resetTestForm();
    loadTestingMatrix();
  };

  const updateTest = async () => {
    const payload = {
      test_code: testCode,
      test_name: testName,
      standard_reference: standardRef,
      test_category: testCategory,
      price_inr: Number(testPrice),
      price_basis: priceBasis,
    };

    await fetch(`${TESTING_API}/${editTest._id}`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    resetTestForm();
    setEditTest(null);
    loadTestingMatrix();
  };

  const deleteTest = async (id: string) => {
    if (!confirm("Delete this test permanently?")) return;
    await fetch(`${TESTING_API}/${id}`, { method: "DELETE", headers: getAuthHeaders() });
    loadTestingMatrix();
  };

  // ---------------- EXPORT / IMPORT LOGIC ----------------

  // NEW: Export function to download all current products to CSV
  const exportCSV = () => {
    if (products.length === 0) return alert("No data to export");
    const csv = Papa.unparse(products);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "product_repository_export.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCSVUpload = (file: File) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => 
        header.toLowerCase().replace(/\uFEFF/g, "").trim().replace(/\s+/g, "_"),
      complete: async (results) => {
        const rows = results.data as any[];
        if (!rows.length) return alert("CSV is empty");

        let success = 0;
        let failed = 0;

        for (const row of rows) {
          if (!row.sku_code || !row.product_name || !row.unit_price_inr) {
            failed++;
            continue;
          }

          const payload: any = {
            sku_code: String(row.sku_code).trim(),
            product_name: String(row.product_name).trim(),
            unit_price_inr: Number(row.unit_price_inr),
          };

          Object.keys(row).forEach((k) => {
            if (!["sku_code", "product_name", "unit_price_inr"].includes(k) && row[k]) {
              payload[k] = row[k];
            }
          });

          try {
            const res = await fetch(API, {
              method: "POST",
              headers: getAuthHeaders(),
              body: JSON.stringify(payload),
            });
            res.ok ? success++ : failed++;
          } catch {
            failed++;
          }
        }
        alert(`✅ Imported ${success} products\n❌ Failed ${failed}`);
        loadProducts();
      },
    });
  };

  return (
    <MainLayout title="Product Repository">
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleCSVUpload(file);
          e.target.value = "";
        }}
      />

      <div className="flex justify-between items-center mb-4">
        <div className="flex gap-3 items-center">
            <Input
              placeholder={t ? t("Repository.searchPlaceholder","Search SKU or Product...") : "Search SKU or Product..."}
              value={searchTerm}
              className="w-64"
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <Badge variant="outline">{localizeDigits(products.length)} {t ? t("Repository.productsLabel","Products") : "Products"}</Badge>
          </div>

        { (hasAnyRole('product','super_admin','superadmin')) && (
          <div className="flex gap-2">
            {/* UPDATED: Export Button replaces Template button */}
            <Button variant="outline" onClick={exportCSV}>
              <Download className="h-4 w-4 mr-2" /> {t ? t("Repository.exportCSV","Export CSV") : "Export CSV"}
            </Button>
            <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-4 w-4 mr-2" /> {t ? t("Repository.importCSV","Import CSV") : "Import CSV"}
            </Button>
            <Button 
              className="bg-blue-600 hover:bg-blue-700 text-white"
              onClick={() => setShowAddDialog(true)}
            >
              <Plus className="h-4 w-4 mr-2" /> {t ? t("Repository.addProduct","Add Product") : "Add Product"}
            </Button>
          </div>
        )}
      </div>

      <Tabs defaultValue="products">
        <TabsList>
          <TabsTrigger 
            value="products"
            className="data-[state=active]:bg-blue-600 data-[state=active]:text-white"
          >
            <Database className="h-4 w-4 mr-1" /> Product Catalog
          </TabsTrigger>
          <TabsTrigger 
            value="testing"
            className="data-[state=active]:bg-blue-600 data-[state=active]:text-white"
          >
            <DollarSign className="h-4 w-4 mr-1" /> Testing Matrix
            <Badge variant="secondary" className="ml-2">{testingMatrix.length}</Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="products">
          <div className="rounded-xl border mt-3">
            <Table>
              <TableHeader>
                <TableRow className="bg-blue-500">
                  <TableHead className="text-black">{t ? t("Repository.table.col.sku","SKU") : "SKU"}</TableHead>
                  <TableHead className="text-black">{t ? t("Repository.table.col.name","Name") : "Name"}</TableHead>
                  <TableHead className="text-right text-black">{t ? t("Repository.table.col.price","Price") : "Price"}</TableHead>
                  <TableHead className="text-center text-black">{t ? t("Repository.table.col.actions","Actions") : "Actions"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.map((p) => (
                  <TableRow key={p._id}>
                    <TableCell className="font-mono">{t ? t(`Repository.product.${p._id}.sku`, p.sku_code) : p.sku_code}</TableCell>
                    <TableCell>{t ? t(`Repository.product.${p._id}.name`, p.product_name) : p.product_name}</TableCell>
                    <TableCell className="text-right">{formatCurrency(p.unit_price_inr)}</TableCell>
                    <TableCell className="flex justify-center gap-2">
                      <Button size="icon" variant="ghost" onClick={() => setSelectedProduct(p)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      { (hasAnyRole('product','super_admin','superadmin')) && (
                        <>
                          <Button size="icon" variant="ghost" onClick={() => {
                            setEditProduct(p);
                            setSkuCode(p.sku_code);
                            setProductName(p.product_name);
                            setUnitPrice(String(p.unit_price_inr));
                            setCustomFields(getExtraFields(p).map(([k, v]) => ({ key: k, value: String(v) })));
                          }}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" className="text-destructive" onClick={() => deleteProduct(p._id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="testing">
          <div className="flex justify-end mb-3">
            <Button 
              className="bg-blue-600 hover:bg-blue-700 text-white"
              onClick={() => setShowAddTestDialog(true)}
            >
              <Plus className="h-4 w-4 mr-2" /> {t ? t("Repository.addTest","Add Test") : "Add Test"}
            </Button>
          </div>
          <div className="rounded-xl border">
            <Table>
                <TableHeader>
                <TableRow className="bg-blue-500">
                  <TableHead className="text-black">{t ? t("Repository.table.col.testCode","Test Code") : "Test Code"}</TableHead>
                  <TableHead className="text-black">{t ? t("Repository.table.col.testName","Test Name") : "Test Name"}</TableHead>
                  <TableHead className="text-black">{t ? t("Repository.table.col.standard","Standard") : "Standard"}</TableHead>
                  <TableHead className="text-black">{t ? t("Repository.table.col.category","Category") : "Category"}</TableHead>
                  <TableHead className="text-right text-black">{t ? t("Repository.table.col.price","Price") : "Price"}</TableHead>
                  <TableHead className="text-center text-black">{t ? t("Repository.table.col.actions","Actions") : "Actions"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {testingMatrix.map((testItem) => (
                  <TableRow key={testItem._id}>
                    <TableCell className="font-mono">{t ? t(`Repository.test.${testItem._id}.code`, testItem.test_code) : testItem.test_code}</TableCell>
                    <TableCell>{t ? t(`Repository.test.${testItem._id}.name`, testItem.test_name) : testItem.test_name}</TableCell>
                    <TableCell>{t ? t(`Repository.test.${testItem._id}.standard`, testItem.standard_reference) : testItem.standard_reference}</TableCell>
                    <TableCell>{t ? t(`Repository.test.${testItem._id}.category`, testItem.test_category) : testItem.test_category}</TableCell>
                    <TableCell className="text-right">{formatCurrency(testItem.price_inr)}</TableCell>
                    <TableCell className="flex justify-center gap-2">
                      <Button size="icon" variant="ghost" onClick={() => {
                        setEditTest(testItem);
                        setTestCode(testItem.test_code);
                        setTestName(testItem.test_name);
                        setStandardRef(testItem.standard_reference);
                        setTestCategory(testItem.test_category);
                        setTestPrice(String(testItem.price_inr));
                        setPriceBasis(testItem.price_basis || "");
                      }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="text-destructive" onClick={() => deleteTest(testItem._id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* VIEW MODAL */}
      <Dialog open={!!selectedProduct} onOpenChange={() => setSelectedProduct(null)}>
          <DialogContent>
          <DialogHeader><DialogTitle>{t ? t("Repository.view.title","Product Details") : "Product Details"}</DialogTitle></DialogHeader>
          {selectedProduct && (
            <div className="space-y-2">
              <p><b>{t ? t("Repository.view.sku","SKU:") : "SKU:"}</b> {t ? t(`Repository.product.${selectedProduct._id}.sku`, selectedProduct.sku_code) : selectedProduct.sku_code}</p>
              <p><b>{t ? t("Repository.view.name","Name:") : "Name:"}</b> {t ? t(`Repository.product.${selectedProduct._id}.name`, selectedProduct.product_name) : selectedProduct.product_name}</p>
              <p><b>{t ? t("Repository.view.price","Price:") : "Price:"}</b> {formatCurrency(selectedProduct.unit_price_inr)}</p>
              <hr />
              {getExtraFields(selectedProduct).map(([k, v]) => (
                <div key={k} className="flex justify-between text-sm">
                  <span className="capitalize">{k.replace(/_/g, " ")}</span>
                  <span>{t ? t(`Repository.product.${selectedProduct._id}.field.${k}`, String(v)) : String(v)}</span>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ADD/EDIT MODAL */}
      <Dialog open={showAddDialog || !!editProduct} onOpenChange={() => { resetForm(); setEditProduct(null); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editProduct ? "Edit Product" : "Add Product"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>SKU</Label><Input value={skuCode} onChange={(e) => setSkuCode(e.target.value)} /></div>
            <div><Label>Name</Label><Input value={productName} onChange={(e) => setProductName(e.target.value)} /></div>
            <div><Label>Price</Label><Input type="number" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} /></div>
            <div>
              <Label>Extra Attributes</Label>
              {customFields.map((f, i) => (
                <div key={i} className="flex gap-2 mt-2">
                  <Input placeholder="Field Name" value={f.key} onChange={(e) => {
                    const c = [...customFields]; c[i].key = e.target.value; setCustomFields(c);
                  }} />
                  <Input placeholder="Value" value={f.value} onChange={(e) => {
                    const c = [...customFields]; c[i].value = e.target.value; setCustomFields(c);
                  }} />
                  <Button variant="ghost" onClick={() => setCustomFields(customFields.filter((_, idx) => idx !== i))}>✕</Button>
                </div>
              ))}
              <Button variant="outline" size="sm" className="mt-2" onClick={() => setCustomFields([...customFields, { key: "", value: "" }])}>+ Add Field</Button>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { resetForm(); setEditProduct(null); }}>Cancel</Button>
              <Button 
                className="bg-blue-600 hover:bg-blue-700 text-white"
                onClick={editProduct ? updateProduct : saveProduct}
              >
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* TESTING MATRIX ADD/EDIT MODAL */}
      <Dialog open={showAddTestDialog || !!editTest} onOpenChange={() => { resetTestForm(); setEditTest(null); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editTest ? "Edit Test" : "Add Test"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Test Code *</Label><Input value={testCode} onChange={(e) => setTestCode(e.target.value)} /></div>
            <div><Label>Test Name *</Label><Input value={testName} onChange={(e) => setTestName(e.target.value)} /></div>
            <div><Label>Standard Reference</Label><Input value={standardRef} onChange={(e) => setStandardRef(e.target.value)} /></div>
            <div><Label>Test Category</Label><Input value={testCategory} onChange={(e) => setTestCategory(e.target.value)} /></div>
            <div><Label>Price (INR) *</Label><Input type="number" value={testPrice} onChange={(e) => setTestPrice(e.target.value)} /></div>
            <div><Label>Price Basis</Label><Input value={priceBasis} onChange={(e) => setPriceBasis(e.target.value)} placeholder="e.g., Per Sample, Per Test" /></div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { resetTestForm(); setEditTest(null); }}>Cancel</Button>
              <Button 
                className="bg-blue-600 hover:bg-blue-700 text-white"
                onClick={editTest ? updateTest : saveTest}
              >
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}