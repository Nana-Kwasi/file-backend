import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from './AuthContext';
export const INVOICE_STATUS = {
  PENDING: 'PENDING',
  REVIEW_1: 'First Approve',
  REVIEW_2: 'Second Approve',
  REVIEW_3: 'Third Approve',
  PAID: 'Paid',
};

export const PO_STATUS = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  SIGNED: 'SIGNED',
};

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

const InvoiceContext = createContext(null);
export const InvoiceProvider = ({ children }) => {
  const [invoices, setInvoices] = useState([]);
  const [poFiles, setPoFiles] = useState([]);
  const { user } = useAuth();

  useEffect(() => {
    // Fetch invoices and PO files when the component mounts
    const fetchInvoices = async () => {
      try {
        const response = await axios.get('http://localhost:5000/invoices');
        setInvoices(response.data);
      } catch (error) {
        console.error('Error fetching invoices:', error);
      }
    };

    const fetchPOFiles = async () => {
      try {
        const response = await axios.get('http://localhost:5000/poFiles');
        setPoFiles(response.data);
      } catch (error) {
        console.error('Error fetching PO files:', error);
      }
    };

    fetchInvoices();
    fetchPOFiles();
  }, []);

  // Helper function to read a file as Data URL
  const readFileAsDataURL = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = () => reject(new Error('File reading failed'));
      reader.readAsDataURL(file);
    });
  };

  // Function to add a single invoice
  const addInvoice = async (file, amount) => {
    if (!user) return null;

    if (file.size > MAX_FILE_SIZE) {
      alert('File size exceeds the maximum limit of 50MB');
      throw new Error('FILE_TOO_LARGE');
    }

    try {
      const content = await readFileAsDataURL(file);
      const newInvoice = {
        name: file.name,
        type: file.type,
        date: new Date().toISOString().split('T')[0],
        time: new Date().toLocaleTimeString(),
        status: INVOICE_STATUS.PENDING,
        amount: amount ? parseFloat(amount) : 0,
        sender: user.email,
        department: user.department,
        uploaded_by: user.email,
        size: (file.size / 1024).toFixed(2),
        last_modified: new Date(file.lastModified).toISOString(),
        content: content,
      };

      const response = await axios.post('http://localhost:5000/invoices', newInvoice);
      setInvoices((prevInvoices) => [...prevInvoices, response.data]);
      return response.data;
    } catch (error) {
      console.error('Error adding invoice:', error);
      throw error;
    }
  };

  // Function to add multiple invoices
  const addMultipleInvoices = async (files, amounts) => {
    if (!user) return null;

    const promises = Array.from(files).map((file) => {
      const fileAmount = amounts[file.name];
      return addInvoice(file, fileAmount);
    });

    return Promise.all(promises);
  };

  // Function to update invoice status
  const updateInvoiceStatus = async (invoiceId, newStatus) => {
    try {
      const response = await axios.put(
        `http://localhost:5000/invoices/${invoiceId}/status`,
        { status: newStatus }
      );
      setInvoices((prevInvoices) =>
        prevInvoices.map((invoice) =>
          invoice.id === invoiceId ? response.data : invoice
        )
      );
    } catch (error) {
      console.error('Error updating invoice status:', error);
    }
  };

  // Function to download an invoice
  const downloadInvoice = async (invoice) => {
    try {
      const response = await axios.get(
        `http://localhost:5000/invoices/${invoice.id}/download`,
        { responseType: 'blob' }
      );

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', invoice.name);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error downloading invoice:', error);
    }
  };

  // Function to add a single PO file
  const addPOFile = async (file) => {
    if (!user) return null;

    if (file.size > MAX_FILE_SIZE) {
      alert('File size exceeds the maximum limit of 50MB');
      throw new Error('FILE_TOO_LARGE');
    }

    try {
      const content = await readFileAsDataURL(file);
      const newPOFile = {
        name: file.name,
        type: file.type,
        date: new Date().toISOString().split('T')[0],
        time: new Date().toLocaleTimeString(),
        status: PO_STATUS.PENDING,
        sender: user.email,
        username: user.username,
        department: user.department,
        uploaded_by: user.email,
        size: (file.size / 1024).toFixed(2),
        last_modified: new Date(file.lastModified).toISOString(),
        content: content,
      };

      const response = await axios.post('http://localhost:5000/poFiles', newPOFile);
      setPoFiles((prevFiles) => [...prevFiles, response.data]);
      return response.data;
    } catch (error) {
      console.error('Error adding PO file:', error);
      throw error;
    }
  };

  // Function to add multiple PO files
  const addMultiplePOFiles = async (files) => {
    if (!user) return null;

    const promises = Array.from(files).map((file) => addPOFile(file));
    return Promise.all(promises);
  };

  // Function to update PO file status
  const updatePOFileStatus = async (fileId, newStatus) => {
    try {
      const response = await axios.put(
        `http://localhost:5000/poFiles/${fileId}/status`,
        { status: newStatus }
      );
      setPoFiles((prevFiles) =>
        prevFiles.map((file) =>
          file.id === fileId ? response.data : file
        )
      );
    } catch (error) {
      console.error('Error updating PO file status:', error);
    }
  };

  // Function to upload signed PO file
  const uploadSignedPOFile = async (fileId, signedFile) => {
    if (signedFile.size > MAX_FILE_SIZE) {
      alert('File size exceeds the maximum limit of 50MB');
      return null;
    }

    const formData = new FormData();
    formData.append('signedFile', signedFile);

    try {
      const response = await axios.post(
        `http://localhost:5000/poFiles/${fileId}/uploadSigned`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );
      setPoFiles((prevFiles) =>
        prevFiles.map((file) =>
          file.id === fileId ? response.data : file
        )
      );
      return response.data;
    } catch (error) {
      console.error('Error uploading signed PO file:', error);
      throw error;
    }
  };

  // Function to download a PO file
  const downloadPOFile = async (file, signed = false) => {
    try {
      const endpoint = signed
        ? `http://localhost:5000/poFiles/${file.id}/download?signed=true`
        : `http://localhost:5000/poFiles/${file.id}/download`;

      const response = await axios.get(endpoint, { responseType: 'blob' });

      const fileName = signed ? file.signed_file_name || `signed_${file.name}` : file.name;

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error downloading PO file:', error);
    }
  };

  // Function to determine if the user can edit an invoice
  const canEditInvoice = (invoice) => {
    if (!user) return false;

    if (user.department === 'FINANCE') {
      switch (user.role) {
        case 'FINANCE_REVIEWER_1':
          return invoice.status === INVOICE_STATUS.PENDING;
        case 'FINANCE_REVIEWER_2':
          return invoice.status === INVOICE_STATUS.REVIEW_1;
        case 'FINANCE_REVIEWER_3':
          return invoice.status === INVOICE_STATUS.REVIEW_2;
        case 'FINANCE_REVIEWER_4':
          return invoice.status === INVOICE_STATUS.REVIEW_3;
        default:
          return false;
      }
    }
    return false;
  };

  // Function to get visible invoices based on user role
  const getVisibleInvoices = () => {
    if (!user) return [];

    if (user.department === 'FINANCE') {
      switch (user.role) {
        case 'FINANCE_REVIEWER_1':
          return invoices.filter((i) => i.status === INVOICE_STATUS.PENDING);
        case 'FINANCE_REVIEWER_2':
          return invoices.filter((i) => i.status === INVOICE_STATUS.REVIEW_1);
        case 'FINANCE_REVIEWER_3':
          return invoices.filter((i) => i.status === INVOICE_STATUS.REVIEW_2);
        case 'FINANCE_REVIEWER_4':
          return invoices.filter((i) => i.status === INVOICE_STATUS.REVIEW_3);
        default:
          return [];
      }
    } else {
      return invoices.filter((i) => i.department === user.department);
    }
  };

  // Function to get visible PO files based on user role
  const getVisiblePOFiles = () => {
    if (!user) return [];

    if (user.department === 'FINANCE') {
      return poFiles;
    } else {
      return poFiles.filter((file) => file.department === user.department);
    }
  };

  return (
    <InvoiceContext.Provider
      value={{
        invoices: getVisibleInvoices(),
        poFiles: getVisiblePOFiles(),
        addInvoice,
        addMultipleInvoices,
        addPOFile,
        addMultiplePOFiles,
        updateInvoiceStatus,
        updatePOFileStatus,
        uploadSignedPOFile,
        canEditInvoice,
        downloadInvoice,
        downloadPOFile,
        INVOICE_STATUS,
        PO_STATUS,
      }}
    >
      {children}
    </InvoiceContext.Provider>
  );
};

export const useInvoices = () => {
  const context = useContext(InvoiceContext);
  if (!context) {
    throw new Error('useInvoices must be used within an InvoiceProvider');
  }
  return context;context;
};