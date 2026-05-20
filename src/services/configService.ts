import { 
  hasSpContext, 
  spListExists, 
  spCreateList, 
  spListEnsureNumberField, 
  spListEnsureTextField,
  spListEnsureMultiLineTextField,
  spListGetItems,
  spListAddItem,
  spListUpdateItem,
  spListDeleteItem,
  getCurrentSharePointUserEmail
} from './spService';
import { SQL_QUERY_ESTOQUE, SQL_QUERY_VALIDACAO_SISTEMICA, SQL_QUERY_SEPARACAO_SALDO } from './queryService';
import { Section, Metric } from '../types';

const LIST_DIVISOES = "App_Dash_Divisoes";
const LIST_CARDS = "App_Dash_Cards";
const LIST_RULES = "App_Dash_Regras";
export const LIST_USERS = "App_Dash_Users";

export async function ensureSharePointConfig() {
  if (!hasSpContext()) return;
  
  try {
    console.log("Checking SharePoint Config...");
    // 1. Ensure Divisoes List
    if (!(await spListExists(LIST_DIVISOES))) {
      console.log("Creating list Divisões...");
      await spCreateList(LIST_DIVISOES);
      await spListEnsureNumberField(LIST_DIVISOES, "OrderIndex");
      
      // Seed initial divisions
      const div1 = await spListAddItem(LIST_DIVISOES, { Title: "Separação de saldo", OrderIndex: 1 });
      const div2 = await spListAddItem(LIST_DIVISOES, { Title: "Validação sistêmica", OrderIndex: 2 });
      const div3 = await spListAddItem(LIST_DIVISOES, { Title: "Qualidade operacional", OrderIndex: 3 });

      // 2. Ensure Cards List
      if (!(await spListExists(LIST_CARDS))) {
        console.log("Creating list Cards...");
        await spCreateList(LIST_CARDS);
        await spListEnsureNumberField(LIST_CARDS, "DivisionId");
        await spListEnsureNumberField(LIST_CARDS, "OrderIndex");
        await spListEnsureNumberField(LIST_CARDS, "RefreshInterval");
        await spListEnsureTextField(LIST_CARDS, "LastUpdateDate");
        await spListEnsureTextField(LIST_CARDS, "HistoryData");
        await spListEnsureMultiLineTextField(LIST_CARDS, "SqlQuery");
        await spListEnsureMultiLineTextField(LIST_CARDS, "Objective");
        await spListEnsureMultiLineTextField(LIST_CARDS, "CachedData");

        // Seed initial cards mapping to the seeded divisions
        if (div1.status && div2.status && div3.status) {
          await spListAddItem(LIST_CARDS, {
            Title: "Separação de saldo",
            DivisionId: div1.data.id,
            SqlQuery: SQL_QUERY_SEPARACAO_SALDO,
            Objective: "Consulta dinâmica de separação de saldo.",
            RefreshInterval: 5,
            OrderIndex: 1
          });
          await spListAddItem(LIST_CARDS, {
            Title: "Validação sistemica",
            DivisionId: div2.data.id,
            SqlQuery: SQL_QUERY_VALIDACAO_SISTEMICA,
            Objective: "Consulta dinâmica de validação sistêmica.",
            RefreshInterval: 5,
            OrderIndex: 2
          });
          await spListAddItem(LIST_CARDS, {
            Title: "Estoque da validação sistemica",
            DivisionId: div3.data.id,
            SqlQuery: SQL_QUERY_ESTOQUE,
            Objective: "Consulta dinâmica de estoque via validação sistêmica.",
            RefreshInterval: 10,
            OrderIndex: 3
          });
        }
      }

      // 3. Ensure Rules List
      if (!(await spListExists(LIST_RULES))) {
        console.log("Creating list Regras...");
        await spCreateList(LIST_RULES);
        await spListEnsureNumberField(LIST_RULES, "CardId");
        
        // Seed initial rules for 1, 2, 3
        const seedRules = [
          { CardId: 1, Title: "Estoque físico vs sistêmico deve ser zero." },
          { CardId: 1, Title: "Transações pendentes há mais de 24h são críticas." },
          { CardId: 2, Title: "Validar se todos os SKUs possuem peso cadastrado." },
          { CardId: 2, Title: "Divergência superior a 5% exige recontagem." },
          { CardId: 3, Title: "Saldo bloqueado deve ter motivo preenchido." },
          { CardId: 3, Title: "Comparar reserva vs disponível no WMS." }
        ];

        for (const rule of seedRules) {
          await spListAddItem(LIST_RULES, rule);
        }
      }
    } else {
      // Just ensure fields if list already existed
      await spListEnsureNumberField(LIST_DIVISOES, "OrderIndex");
      if (!(await spListExists(LIST_CARDS))) {
        await spCreateList(LIST_CARDS);
        await spListEnsureNumberField(LIST_CARDS, "DivisionId");
        await spListEnsureNumberField(LIST_CARDS, "OrderIndex");
        await spListEnsureNumberField(LIST_CARDS, "RefreshInterval");
        await spListEnsureTextField(LIST_CARDS, "LastUpdateDate");
        await spListEnsureTextField(LIST_CARDS, "HistoryData");
        await spListEnsureMultiLineTextField(LIST_CARDS, "SqlQuery");
        await spListEnsureMultiLineTextField(LIST_CARDS, "Objective");
        await spListEnsureMultiLineTextField(LIST_CARDS, "CachedData");
      } else {
        // Ensure new fields on existing list
        await spListEnsureNumberField(LIST_CARDS, "RefreshInterval");
        await spListEnsureTextField(LIST_CARDS, "LastUpdateDate");
        await spListEnsureTextField(LIST_CARDS, "HistoryData");
        await spListEnsureMultiLineTextField(LIST_CARDS, "CachedData");
        await spListEnsureMultiLineTextField(LIST_CARDS, "SqlQuery");
        await spListEnsureMultiLineTextField(LIST_CARDS, "Objective");
      }

      // Ensure Rules list exists and fields are correct
      if (!(await spListExists(LIST_RULES))) {
        await spCreateList(LIST_RULES);
        await spListEnsureNumberField(LIST_RULES, "CardId");
      }
    }

    // Ensure App_Dash_Users list exists and fields are correct
    if (!(await spListExists(LIST_USERS))) {
      console.log("Creating list Users (App_Dash_Users)...");
      await spCreateList(LIST_USERS);
      await spListEnsureTextField(LIST_USERS, "Email");
      
      const currentEmail = getCurrentSharePointUserEmail();
      if (currentEmail) {
        await spListAddItem(LIST_USERS, { Title: currentEmail, Email: currentEmail });
      }
      await spListAddItem(LIST_USERS, { Title: "arlenloran@gmail.com", Email: "arlenloran@gmail.com" });
    } else {
      await spListEnsureTextField(LIST_USERS, "Email");
    }

    console.log("Config structure verified.");
  } catch (err) {
    console.error("Critical error ensuring SharePoint structure:", err);
  }
}

export async function addDivision(title: string, orderIndex: number) {
  if (!hasSpContext()) {
    const sections = getLocalConfigFromStorage();
    const newId = `mock_sec_${Math.random()}`;
    const newDiv: Section = { id: newId, title, orderIndex, metrics: [] };
    sections.push(newDiv);
    localStorage.setItem('dash_config_mock', JSON.stringify(sections));
    return { id: newId, Title: title, OrderIndex: orderIndex };
  }
  const res = await spListAddItem(LIST_DIVISOES, { Title: title, OrderIndex: orderIndex });
  if (res.status) return res.data;
  throw new Error(res.message);
}

export async function updateDivision(id: string, title: string, orderIndex: number) {
  if (!hasSpContext()) {
    const sections = getLocalConfigFromStorage();
    const section = sections.find(s => s.id === id || s.title === id);
    if (section) {
      section.title = title;
      section.orderIndex = orderIndex;
    }
    localStorage.setItem('dash_config_mock', JSON.stringify(sections));
    return { id, Title: title, OrderIndex: orderIndex };
  }
  const res = await spListUpdateItem(LIST_DIVISOES, Number(id), { Title: title, OrderIndex: orderIndex });
  if (!res.status) throw new Error(res.message);
}

export async function deleteDivision(id: string) {
  if (!hasSpContext()) {
    const sections = getLocalConfigFromStorage().filter(s => s.title !== id && s.id !== id);
    localStorage.setItem('dash_config_mock', JSON.stringify(sections));
    return;
  }
  await spListDeleteItem(LIST_DIVISOES, Number(id));
}

export async function deleteMetric(id: string) {
  if (!hasSpContext()) {
    const sections = getLocalConfigFromStorage();
    sections.forEach(s => {
      s.metrics = s.metrics.filter(m => m.id !== id);
    });
    localStorage.setItem('dash_config_mock', JSON.stringify(sections));
    return;
  }
  await spListDeleteItem(LIST_CARDS, Number(id));
}

export async function addMetric(divisionId: string, metric: Partial<Metric>) {
  if (!hasSpContext()) {
    const sections = getLocalConfigFromStorage();
    const section = sections.find(s => s.title === divisionId || s.id === divisionId);
    if (section) {
      const now = new Date();
      const newMetric = { 
        ...metric, 
        id: Math.random().toString(),
        value: 0,
        status: 'ok' as const,
        lastUpdate: now.toLocaleString('pt-BR'),
        lastUpdateAt: now.toISOString(),
        orderIndex: metric.orderIndex || (section.metrics.length + 1),
        history: [],
        details: []
      } as Metric;
      section.metrics.push(newMetric);
      localStorage.setItem('dash_config_mock', JSON.stringify(sections));
    }
    return { id: Math.random().toString(), ...metric };
  }
  const res = await spListAddItem(LIST_CARDS, {
    Title: metric.title,
    DivisionId: Number(divisionId),
    SqlQuery: metric.sqlQuery,
    Objective: metric.objective,
    RefreshInterval: metric.refreshInterval,
    OrderIndex: metric.orderIndex || 1,
    LastUpdateDate: new Date().toISOString()
  });
  
  if (!res.status) throw new Error(res.message);

  // Rules
  if (metric.rules && metric.rules.length > 0) {
    for (const rule of metric.rules) {
      if (rule.trim()) {
        await spListAddItem(LIST_RULES, { Title: rule.trim(), CardId: res.data.id });
      }
    }
  }

  return res.data;
}

export async function updateMetric(id: string, metric: Partial<Metric>) {
  if (!hasSpContext()) {
    const sections = getLocalConfigFromStorage();
    sections.forEach(s => {
      const mIdx = s.metrics.findIndex(m => m.id === id);
      if (mIdx !== -1) {
        s.metrics[mIdx] = { ...s.metrics[mIdx], ...metric };
      }
    });
    localStorage.setItem('dash_config_mock', JSON.stringify(sections));
    return;
  }
  const fields: any = {
    Title: metric.title,
    SqlQuery: metric.sqlQuery,
    Objective: metric.objective,
    RefreshInterval: metric.refreshInterval,
    LastUpdateDate: metric.lastUpdateAt || new Date().toISOString()
  };
  if (metric.orderIndex !== undefined) {
    fields.OrderIndex = metric.orderIndex;
  }
  const res = await spListUpdateItem(LIST_CARDS, Number(id), fields);
  if (!res.status) throw new Error(res.message);

  // Sync rules: simpler to clear and re-add for this context
  if (metric.rules) {
    try {
      const existingRulesRes = await spListGetItems(LIST_RULES, { filter: `CardId eq ${id}` });
      if (existingRulesRes.status) {
        for (const rule of existingRulesRes.data) {
          await spListDeleteItem(LIST_RULES, rule.Id);
        }
      }
      for (const ruleText of metric.rules) {
        if (ruleText.trim()) {
          await spListAddItem(LIST_RULES, { Title: ruleText, CardId: Number(id) });
        }
      }
    } catch (err) {
      console.error("Error syncing rules:", err);
    }
  }
}

export async function fetchDashboardConfig(): Promise<Section[]> {
  if (!hasSpContext()) {
    console.log("Using Mock Storage for Config");
    return getLocalConfigFromStorage();
  }

  try {
    console.log("Fetching config from SharePoint...");
    const [divRes, cardRes, ruleRes] = await Promise.all([
      spListGetItems(LIST_DIVISOES, { orderBy: "OrderIndex asc" }),
      spListGetItems(LIST_CARDS, { orderBy: "OrderIndex asc" }),
      spListGetItems(LIST_RULES)
    ]);

    if (!divRes.status || !cardRes.status || !ruleRes.status) throw new Error("Failed to fetch SP config");

    const divisions = divRes.data;
    const cards = cardRes.data;
    const allRules = ruleRes.data;

    const sections: Section[] = divisions.map((div: any) => ({
      id: String(div.Id),
      title: div.Title,
      orderIndex: div.OrderIndex || 0,
      metrics: cards
        .filter((c: any) => Number(c.DivisionId) === Number(div.Id))
        .map((c: any) => {
          let cachedDetails: any[] = [];
          let cachedValue: number = 0;
          if (c.CachedData) {
            try {
              cachedDetails = JSON.parse(c.CachedData);
              cachedValue = Array.isArray(cachedDetails) ? cachedDetails.length : 0;
            } catch (e) {
              console.error("Error parsing cached data for metric", c.Id, e);
            }
          }

          // Rules for this card
          const cardRules = allRules
            .filter((r: any) => Number(r.CardId) === Number(c.Id))
            .map((r: any) => r.Title);

          // History from comma separated string
          let history: number[] = [];
          if (c.HistoryData) {
            history = c.HistoryData.split(',').map(Number).filter((n: any) => !isNaN(n));
          }

          return {
            id: String(c.Id),
            title: c.Title,
            value: cachedValue,
            status: (cachedValue > 0 ? 'error' : 'ok') as 'error' | 'ok',
            lastUpdate: c.LastUpdateDate ? new Date(c.LastUpdateDate).toLocaleString('pt-BR') : 'Não atualizado',
            lastUpdateAt: c.LastUpdateDate || undefined,
            refreshInterval: c.RefreshInterval || 5, // Default 5 mins
            isDynamic: true,
            objective: c.Objective,
            sqlQuery: c.SqlQuery, // Persist query to fetch later
            history: history,
            details: cachedDetails,
            rules: cardRules,
            orderIndex: c.OrderIndex || 0
          };
        })
    }));

    // Sort sections and their metrics to make sure sorting is strictly applied
    sections.sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
    sections.forEach(s => {
      s.metrics.sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
    });

    return sections;
  } catch (error) {
    console.error("Config fetch error:", error);
    return getLocalConfigFromStorage();
  }
}

export async function saveMetricData(metricId: string, dateIso: string, data?: any, history?: number[]) {
  if (!hasSpContext()) {
    const sections = getLocalConfigFromStorage();
    sections.forEach(s => {
      const mIdx = s.metrics.findIndex(m => m.id === metricId);
      if (mIdx !== -1) {
        s.metrics[mIdx] = { 
          ...s.metrics[mIdx], 
          lastUpdateAt: dateIso,
          lastUpdate: new Date(dateIso).toLocaleString('pt-BR'),
          details: data !== undefined ? data : s.metrics[mIdx].details,
          history: history !== undefined ? history : s.metrics[mIdx].history,
          value: data !== undefined && Array.isArray(data) ? data.length : s.metrics[mIdx].value,
          status: data !== undefined && Array.isArray(data) && data.length > 0 ? 'error' : 'ok'
        };
      }
    });
    localStorage.setItem('dash_config_mock', JSON.stringify(sections));
    return;
  }
  try {
    const fields: any = {
      LastUpdateDate: dateIso
    };
    if (data !== undefined) {
      fields.CachedData = JSON.stringify(data);
    }
    if (history !== undefined) {
      fields.HistoryData = history.join(',');
    }
    await spListUpdateItem(LIST_CARDS, Number(metricId), fields);
  } catch (err) {
    console.error("Error saving metric data to SP:", err);
  }
}

function getLocalConfigFromStorage(): Section[] {
  const saved = localStorage.getItem('dash_config_mock');
  let sections: Section[] = [];
  if (saved) {
    try {
      sections = JSON.parse(saved);
    } catch (e) {
      sections = getLocalConfig();
    }
  } else {
    sections = getLocalConfig();
  }

  // Ensure default IDs and OrderIndices exist in mock mode
  sections.forEach((s, sIdx) => {
    if (!s.id) s.id = `mock_sec_${sIdx + 1}`;
    if (s.orderIndex === undefined) s.orderIndex = sIdx + 1;
    s.metrics.forEach((m, mIdx) => {
      if (!m.id) m.id = `mock_met_${sIdx + 1}_${mIdx + 1}`;
      if (m.orderIndex === undefined) m.orderIndex = mIdx + 1;
    });
  });

  // Sort sections and their metrics
  sections.sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
  sections.forEach(s => {
    s.metrics.sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
  });

  return sections;
}

export async function saveDivisionsIndices(orderedDivIds: string[]): Promise<boolean> {
  if (!hasSpContext()) {
    const sections = getLocalConfigFromStorage();
    orderedDivIds.forEach((id, idx) => {
      const section = sections.find(s => s.id === id || s.title === id);
      if (section) {
        section.orderIndex = idx + 1;
      }
    });
    localStorage.setItem('dash_config_mock', JSON.stringify(sections));
    return true;
  }
  try {
    for (let idx = 0; idx < orderedDivIds.length; idx++) {
      const id = orderedDivIds[idx];
      await spListUpdateItem(LIST_DIVISOES, Number(id), { OrderIndex: idx + 1 });
    }
    return true;
  } catch (err) {
    console.error("Error saving divisions order:", err);
    return false;
  }
}

export async function saveMetricsIndices(divisionId: string, orderedMetricIds: string[]): Promise<boolean> {
  if (!hasSpContext()) {
    const sections = getLocalConfigFromStorage();
    const section = sections.find(s => s.id === divisionId || s.title === divisionId);
    if (section) {
      orderedMetricIds.forEach((id, idx) => {
        const metric = section.metrics.find(m => m.id === id);
        if (metric) {
          metric.orderIndex = idx + 1;
        }
      });
      localStorage.setItem('dash_config_mock', JSON.stringify(sections));
    }
    return true;
  }
  try {
    for (let idx = 0; idx < orderedMetricIds.length; idx++) {
      const id = orderedMetricIds[idx];
      await spListUpdateItem(LIST_CARDS, Number(id), { OrderIndex: idx + 1, DivisionId: Number(divisionId) });
    }
    return true;
  } catch (err) {
    console.error("Error saving metrics order:", err);
    return false;
  }
}

function getLocalConfig(): Section[] {
  return [
    {
      title: "Separação de saldo",
      metrics: [
        { 
          id: '3', title: "Separação de saldo", value: 0, status: 'ok', 
          lastUpdate: new Date().toLocaleString('pt-BR'),
          lastUpdateAt: new Date().toISOString(),
          refreshInterval: 5,
          isDynamic: true,
          sqlQuery: SQL_QUERY_SEPARACAO_SALDO,
          objective: "Consulta dinâmica de separação de saldo.",
          history: [],
          details: [],
          rules: ["Estoque físico vs sistêmico deve ser zero.", "Transações pendentes há mais de 24h são críticas."]
        }
      ]
    },
    {
      title: "Validação sistêmica",
      metrics: [
        { 
          id: '2', title: "Validação sistemica", value: 0, status: 'ok', 
          lastUpdate: new Date().toLocaleString('pt-BR'),
          lastUpdateAt: new Date().toISOString(),
          refreshInterval: 5,
          isDynamic: true,
          sqlQuery: SQL_QUERY_VALIDACAO_SISTEMICA,
          objective: "Consulta dinâmica de validação sistêmica.",
          history: [],
          details: [],
          rules: ["Validar se todos os SKUs possuem peso cadastrado.", "Divergência superior a 5% exige recontagem."]
        }
      ]
    },
    {
      title: "Qualidade operacional",
      metrics: [
        { 
          id: '1', title: "Estoque da validação sistemica", value: 0, status: 'ok', 
          lastUpdate: new Date().toLocaleString('pt-BR'),
          lastUpdateAt: new Date().toISOString(),
          refreshInterval: 10,
          isDynamic: true,
          sqlQuery: SQL_QUERY_ESTOQUE,
          objective: "Consulta dinâmica de estoque via validação sistêmica.",
          history: [],
          details: [],
          rules: ["Saldo bloqueado deve ter motivo preenchido.", "Comparar reserva vs disponível no WMS."]
        }
      ]
    }
  ];
}

function getLocalUsersFromStorage(): string[] {
  const saved = localStorage.getItem('dash_users_mock');
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {
      return ["arlenloran@gmail.com", "admin@mock.com"];
    }
  }
  const defaultList = ["arlenloran@gmail.com", "admin@mock.com"];
  localStorage.setItem('dash_users_mock', JSON.stringify(defaultList));
  return defaultList;
}

export async function isUserAllowed(email: string): Promise<boolean> {
  const normalized = email.toLowerCase().trim();
  if (!normalized) return false;

  if (!hasSpContext()) {
    const list = getLocalUsersFromStorage();
    return list.some(e => e.toLowerCase().trim() === normalized);
  }

  try {
    const res = await spListGetItems<any>(LIST_USERS, {
      filter: `Title eq '${normalized}' or Email eq '${normalized}'`,
      top: 1
    });
    if (res.status && res.data.length > 0) {
      return true;
    }
    return false;
  } catch (err) {
    console.error("Error checking user permission:", err);
    return false;
  }
}

export async function fetchAllowedUsers(): Promise<{ id: string; email: string }[]> {
  if (!hasSpContext()) {
    const list = getLocalUsersFromStorage();
    return list.map((email, idx) => ({ id: String(idx), email }));
  }

  try {
    const res = await spListGetItems<any>(LIST_USERS);
    if (!res.status) throw new Error(res.message);
    return res.data.map((item: any) => ({
      id: String(item.Id),
      email: item.Email || item.Title
    }));
  } catch (err) {
    console.error("Error fetching allowed users:", err);
    return [];
  }
}

export async function addAllowedUser(email: string): Promise<boolean> {
  const normalized = email.toLowerCase().trim();
  if (!normalized) return false;

  if (!hasSpContext()) {
    const list = getLocalUsersFromStorage();
    if (!list.some(e => e.toLowerCase().trim() === normalized)) {
      list.push(normalized);
      localStorage.setItem('dash_users_mock', JSON.stringify(list));
    }
    return true;
  }

  const exists = await isUserAllowed(normalized);
  if (exists) return true;

  const res = await spListAddItem(LIST_USERS, {
    Title: normalized,
    Email: normalized
  });
  return res.status;
}

export async function removeAllowedUser(id: string, email?: string): Promise<boolean> {
  if (!hasSpContext()) {
    let list = getLocalUsersFromStorage();
    if (email) {
      list = list.filter(e => e.toLowerCase().trim() !== email.toLowerCase().trim());
    } else {
      const idx = Number(id);
      if (!isNaN(idx)) {
        list.splice(idx, 1);
      }
    }
    localStorage.setItem('dash_users_mock', JSON.stringify(list));
    return true;
  }

  const res = await spListDeleteItem(LIST_USERS, Number(id));
  return res.status;
}
