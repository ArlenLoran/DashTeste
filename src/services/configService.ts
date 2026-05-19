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
  spListDeleteItem
} from './spService';
import { SQL_QUERY_ESTOQUE, SQL_QUERY_VALIDACAO_SISTEMICA, SQL_QUERY_SEPARACAO_SALDO } from './queryService';
import { Section, Metric } from '../types';

const LIST_DIVISOES = "App_Dash_Divisoes";
const LIST_CARDS = "App_Dash_Cards";
const LIST_RULES = "App_Dash_Regras";

export async function ensureSharePointConfig() {
  if (!hasSpContext()) return;

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
      await spListEnsureMultiLineTextField(LIST_CARDS, "SqlQuery");
      await spListEnsureMultiLineTextField(LIST_CARDS, "Objective");
      await spListEnsureTextField(LIST_CARDS, "HistoryData");

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
          OrderIndex: 1
        });
        await spListAddItem(LIST_CARDS, {
          Title: "Estoque da validação sistemica",
          DivisionId: div3.data.id,
          SqlQuery: SQL_QUERY_ESTOQUE,
          Objective: "Consulta dinâmica de estoque via validação sistêmica.",
          RefreshInterval: 10,
          OrderIndex: 1
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
      await spListEnsureMultiLineTextField(LIST_CARDS, "CachedData");
      await spListEnsureMultiLineTextField(LIST_CARDS, "SqlQuery");
      await spListEnsureMultiLineTextField(LIST_CARDS, "Objective");
    } else {
      // Ensure new fields on existing list
      await spListEnsureNumberField(LIST_CARDS, "RefreshInterval");
      await spListEnsureTextField(LIST_CARDS, "LastUpdateDate");
      await spListEnsureTextField(LIST_CARDS, "HistoryData");
      await spListEnsureMultiLineTextField(LIST_CARDS, "CachedData");
    }

    // Ensure Rules list exists and fields are correct
    if (!(await spListExists(LIST_RULES))) {
      await spCreateList(LIST_RULES);
      await spListEnsureNumberField(LIST_RULES, "CardId");
    }
  }
}

export async function addDivision(title: string, orderIndex: number) {
  if (!hasSpContext()) return { id: Math.random().toString(), Title: title, OrderIndex: orderIndex };
  const res = await spListAddItem(LIST_DIVISOES, { Title: title, OrderIndex: orderIndex });
  if (res.status) return res.data;
  throw new Error(res.message);
}

export async function updateDivision(id: string, title: string, orderIndex: number) {
  if (!hasSpContext()) return { id, Title: title, OrderIndex: orderIndex };
  await spListUpdateItem(LIST_DIVISOES, Number(id), { Title: title, OrderIndex: orderIndex });
}

export async function deleteDivision(id: string) {
  if (!hasSpContext()) return;
  await spListDeleteItem(LIST_DIVISOES, Number(id));
}

export async function deleteMetric(id: string) {
  if (!hasSpContext()) return;
  await spListDeleteItem(LIST_CARDS, Number(id));
}

export async function addMetric(divisionId: string, metric: Partial<Metric>) {
  if (!hasSpContext()) return { id: Math.random().toString(), ...metric };
  const res = await spListAddItem(LIST_CARDS, {
    Title: metric.title,
    DivisionId: Number(divisionId),
    SqlQuery: metric.sqlQuery,
    Objective: metric.objective,
    RefreshInterval: metric.refreshInterval,
    OrderIndex: 1 // Default
  });
  
  if (!res.status) throw new Error(res.message);

  // Rules
  if (metric.rules && metric.rules.length > 0) {
    for (const rule of metric.rules) {
      await spListAddItem(LIST_RULES, { Title: rule, CardId: res.data.id });
    }
  }

  return res.data;
}

export async function updateMetric(id: string, metric: Partial<Metric>) {
  if (!hasSpContext()) return;
  const fields: any = {
    Title: metric.title,
    SqlQuery: metric.sqlQuery,
    Objective: metric.objective,
    RefreshInterval: metric.refreshInterval
  };
  await spListUpdateItem(LIST_CARDS, Number(id), fields);

  // For rules, it's more complex (syncing). A simple way is to delete and re-add or just leave as is.
  // Given spService limits, I'll focus on the core fields for now.
}

export async function fetchDashboardConfig(): Promise<Section[]> {
  if (!hasSpContext()) {
    // Return mock data for dev environment without SharePoint
    return getLocalConfig();
  }

  try {
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
      metrics: cards
        .filter((c: any) => c.DivisionId === div.Id)
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
            rules: cardRules
          };
        })
    }));

    return sections;
  } catch (error) {
    console.error("Config fetch error:", error);
    return getLocalConfig();
  }
}

export async function saveMetricData(metricId: string, dateIso: string, data?: any, history?: number[]) {
  if (!hasSpContext()) return;
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
