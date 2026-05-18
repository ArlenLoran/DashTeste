/**
 * Service to execute SQL queries via Power Automate proxy
 */

/**
 * Gets the base URL for API calls. 
 * Prioritizes process.env.APP_URL but handles placeholders and relative paths.
 */
function getApiBaseUrl(): string {
  let url = (process.env.APP_URL || "").trim().replace(/\/$/, "");
  
  // If it's a placeholder or empty, try to detect from window or use relative
  if (!url || url === "MY_APP_URL" || url.includes("PLACEHOLDER")) {
    // If we're in a browser and NOT on SharePoint domain, use current origin
    if (typeof window !== 'undefined' && !window.location.hostname.includes('sharepoint.com')) {
      return ""; // Relative path is safest on the same origin
    }
    
    // If we ARE on SharePoint, we really need the absolute URL.
    // Try to find it from the script tag as a fallback
    if (typeof document !== 'undefined') {
      const scripts = document.getElementsByTagName('script');
      for (let i = 0; i < scripts.length; i++) {
        const src = scripts[i].src;
        if (src && (src.includes('main.tsx') || src.includes('.js'))) {
          try {
            const parsed = new URL(src);
            // Ignore SharePoint origins
            if (!parsed.hostname.includes('sharepoint.com')) {
              return parsed.origin;
            }
          } catch (e) {}
        }
      }
    }
    
    return ""; // Fallback to relative
  }
  
  return url;
}

export async function postSqlQuery<T = any[]>(query: string, id_score: string = "default"): Promise<T> {
  const baseUrl = getApiBaseUrl();
  const endpoint = `${baseUrl}/api/query`;
  
  console.log(`Executing SQL Query toward: ${endpoint}`);

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ query, id_score })
  });

  const text = await response.text();

  if (!response.ok) {
    let errorMsg = `Erro: ${response.status}`;
    try {
      const errorData = JSON.parse(text);
      errorMsg = errorData.error || errorMsg;
    } catch (e) {
      errorMsg = text || errorMsg;
    }
    throw new Error(errorMsg);
  }

  try {
    return JSON.parse(text);
  } catch (e) {
    console.error("Failed to parse JSON from response:", text);
    throw new Error("Resposta do servidor não está em formato JSON");
  }
}

export const SQL_QUERY_ESTOQUE = `SELECT DISTINCT
    bomhdr.prtnum AS item,
    bomdtl.prtnum AS itensbom,
    prtdsc.lngdsc AS descricao,
    estoque.invsts AS status_estoque,
    COALESCE(estoque.qtd_estoque, 0) AS qtd_estoque
FROM bomhdr
INNER JOIN bomdtl
    ON bomhdr.bomnum = bomdtl.bomnum
INNER JOIN prtdsc
    ON prtdsc.colval = bomdtl.prtnum || '|' || 'CID01' || '|' || 'WH01'
   AND prtdsc.locale_id = 'US_ENGLISH'
LEFT JOIN (
    SELECT
        inventory_view.prtnum,
        inventory_view.invsts,
        SUM(inventory_view.untqty) AS qtd_estoque
    FROM inventory_view
    WHERE inventory_view.invsts IN ('GGD','TRA','TGA','NGD','TRNA')
      AND inventory_view.prtnum NOT LIKE 'KIT%'
      AND inventory_view.ship_line_id IS NULL
    GROUP BY
        inventory_view.prtnum,
        inventory_view.invsts
) estoque
    ON estoque.prtnum = bomdtl.prtnum`;

export const SQL_QUERY_VALIDACAO_SISTEMICA = `SELECT
    pio.invdte AS "INVDTE",
    pio.invnum AS "Nota Fiscal",
    pio.supnum AS "Supplier Number",
    pio.po_num AS "PO Number",
    t.arrdte AS "ARRDTE",
    t.trlr_num AS "TRLR_NUM",
    t.trlr_id AS "TRLR_ID",
    piol.rcvsts AS "STATUS",
    init_rcv_dte AS "INIT_RCV_DTE",
    TO_CHAR(init_rcv_dte, 'HH24:MI:SS') AS "HORA",
    TO_NUMBER(TO_CHAR(init_rcv_dte, 'HH24')) AS "HORA_NUM",
    TO_CHAR(init_rcv_dte, 'YYYY-MM-DD HH24:MI:SS') AS "INIT_RCV_DTE_TXT",
    init_rcv_dte AS "DATETIME",
    completed_date AS "COMPLETED_DATE",
    pio.waybil AS "Waybil",
    io.waybil AS "Waybil 2",
    CAST(init_rcv_dte AS DATE) AS "Date",
    pio.invtyp AS "Inventory Type",
    p.prtfam AS "Part Family",
    p.prtnum AS "Part Number",
    rcvqty AS "Received Quantity",
    rcvqty AS "RCVQTY",
    expqty AS "Expected Quantity",
    (CASE
        WHEN p.prtfam = 'TERMI' THEN p.prtnum
        ELSE NULL
    END) AS "Tecnologia",
    (CASE
        WHEN piol.lotnum IN ('SN','SV') THEN 'SN/SV'
        WHEN piol.lotnum IN ('SD PRETA') THEN 'SD'
        ELSE piol.lotnum
    END) AS "Mascara",
    (CASE
        WHEN d.lngdsc LIKE '%SIMCARD CLARO%' THEN 'CLARO'
        WHEN d.lngdsc LIKE '%SIMCARD VIVO%' THEN 'VIVO'
        WHEN d.lngdsc LIKE '%SIMCARD TIM%' THEN 'TIM'
        ELSE NULL
    END) AS "Operator"
FROM
    rcvinv pio,
    rcvlin piol,
    rimhdr io,
    rcvtrk s,
    trlr t,
    prtmst p,
    supmst f,
    adrmst a,
    PRTDSC D
WHERE pio.wh_id = 'WH01'
    AND pio.invnum = piol.invnum
    AND pio.supnum = piol.supnum
    AND pio.WH_ID = piol.WH_ID
    AND pio.po_num = io.invnum(+)
    AND pio.supnum = io.supnum(+)
    AND pio.WH_ID = io.WH_ID(+)
    AND pio.trknum = s.trknum(+)
    AND s.trlr_id = t.trlr_id(+)
    AND piol.prtnum = p.prtnum
    AND piol.CLIENT_ID = p.prt_client_id
    AND piol.wh_id = p.WH_ID_TMPL
    AND pio.supnum = f.supnum
    AND pio.client_id = f.client_id
    AND f.adr_id = a.adr_id(+)
    AND D.LOCALE_ID = 'US_ENGLISH'
    AND D.COLVAL = PIOL.PRTNUM||'|'||PIOL.PRT_CLIENT_ID||'|'||PIOL.WH_ID
    AND p.prtfam = 'TERMI'
    AND pio.invtyp = 'WOI'
    AND TRUNC(init_rcv_dte) = TRUNC(SYSDATE)`;

export const SQL_QUERY_SEPARACAO_SALDO = `SELECT
    pio.invdte AS "INVDTE",
    pio.invnum AS "Nota Fiscal",
    pio.supnum AS "Supplier Number",
    pio.po_num AS "PO Number",
    t.arrdte AS "ARRDTE",
    t.trlr_num AS "TRLR_NUM",
    t.trlr_id AS "TRLR_ID",
    piol.rcvsts AS "STATUS",
    init_rcv_dte AS "INIT_RCV_DTE",
    TO_CHAR(completed_date, 'HH24:MI:SS') AS "HORA",
    TO_NUMBER(TO_CHAR(completed_date, 'HH24')) AS "HORA_NUM",
    TO_CHAR(completed_date, 'YYYY-MM-DD HH24:MI:SS') AS "INIT_RCV_DTE_TXT",
    completed_date AS "DATETIME",
    completed_date AS "COMPLETED_DATE",
    pio.waybil AS "Waybil",
    io.waybil AS "Waybil 2",
    CAST(completed_date AS DATE) AS "Date",
    pio.invtyp AS "Inventory Type",
    p.prtfam AS "Part Family",
    p.prtnum AS "Part Number",
    rcvqty AS "Received Quantity",
    rcvqty AS "RCVQTY",
    expqty AS "Expected Quantity",
    (CASE
        WHEN p.prtfam = 'TERMI' THEN p.prtnum
        ELSE NULL
    END) AS "Tecnologia",
    (CASE
        WHEN piol.lotnum IN ('SN','SV') THEN 'SN/SV'
        WHEN piol.lotnum IN ('SD PRETA') THEN 'SD'
        ELSE piol.lotnum
    END) AS "Mascara",
    (CASE
        WHEN d.lngdsc LIKE '%SIMCARD CLARO%' THEN 'CLARO'
        WHEN d.lngdsc LIKE '%SIMCARD VIVO%' THEN 'VIVO'
        WHEN d.lngdsc LIKE '%SIMCARD TIM%' THEN 'TIM'
        ELSE NULL
    END) AS "Operator"
FROM
    rcvinv pio,
    rcvlin piol,
    rimhdr io,
    rcvtrk s,
    trlr t,
    prtmst p,
    supmst f,
    adrmst a,
    PRTDSC D
WHERE pio.wh_id = 'WH01'
    AND pio.invnum = piol.invnum
    AND pio.supnum = piol.supnum
    AND pio.WH_ID = piol.WH_ID
    AND pio.po_num = io.invnum(+)
    AND pio.supnum = io.supnum(+)
    AND pio.WH_ID = io.WH_ID(+)
    AND pio.trknum = s.trknum(+)
    AND s.trlr_id = t.trlr_id(+)
    AND piol.prtnum = p.prtnum
    AND piol.CLIENT_ID = p.prt_client_id
    AND piol.wh_id = p.WH_ID_TMPL
    AND pio.supnum = f.supnum
    AND pio.client_id = f.client_id
    AND f.adr_id = a.adr_id(+)
    AND D.LOCALE_ID = 'US_ENGLISH'
    AND D.COLVAL = PIOL.PRTNUM||'|'||PIOL.PRT_CLIENT_ID||'|'||PIOL.WH_ID
    AND p.prtfam = 'TERMI'
    AND pio.invtyp = 'WOI'
    AND completed_date IS NOT NULL
    AND TRUNC(completed_date) = TRUNC(SYSDATE)`;
