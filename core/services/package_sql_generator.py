import time
import random
from datetime import datetime

class PackageSqlGenerator:
    def __init__(self, data: dict):
        self.data = data
        self.sqls = []

        self.package_name = self.data.get('PACKAGE_NAME', '')
        self.package_desc = self.data.get('PACKAGE_DESC', '')
        self.tele_type = self.data.get('TELE_TYPE', 'GSM')
        self.package_type = self.data.get('PACKAGE_TYPE', '1')
        self.package_price = self.data.get('PACKAGE_PRICE', '')
        self.effect_month = self.data.get('EFFECT_MONTH', '')

        self.eff_type = self.data.get('EFF_TYPE', '0')
        self.can_refund = self.data.get('CAN_REFUND', '1')
        self.open_order_flag = self.data.get('OPEN_ORDER_FLAG', '*')
        self.credit_level = self.data.get('CREDIT_LEVEL', '1')

        self.products = self.data.get('PRODUCTS', [])

        self.package_id = self._generate_package_id()

    def _generate_package_id(self):
        timestamp = int(time.time())
        rand_str = f"{random.randint(0, 9999999):07d}"
        return f"PK{timestamp}{rand_str}"[:20]

    def _escape(self, val):
        if val is None or str(val).strip() == '':
            return "null"
        escaped_val = str(val).replace("'", "''")
        return f"'{escaped_val}'"

    def generate(self):
        self.sqls.append("-- 1. 套餐基本信息表 cme_product.cme_package_info")
        self._gen_package_info()

        self.sqls.append("\n-- 2. 套餐产品关联表 cme_product.cme_package_product")
        self._gen_package_product()

        self.sqls.append("\n-- 3. 套餐规则配置表 cme_product.cme_package_rule")
        self._gen_package_rule()

        return "\n".join(self.sqls)

    def _gen_package_info(self):
        sql = f"insert into cme_product.cme_package_info (PACKAGE_ID, PACKAGE_NAME, PACKAGE_DESC, TELE_TYPE, PACKAGE_TYPE, PACKAGE_PRICE, EFFECT_MONTH, PACKAGE_STATUS, DEPT_ID, EFF_FLAG, EFF_DATE, EXP_DATE) values ({self._escape(self.package_id)}, {self._escape(self.package_name)}, {self._escape(self.package_desc)}, {self._escape(self.tele_type)}, {self.package_type}, {self.package_price if self.package_price else 'null'}, {self.effect_month if self.effect_month else 'null'}, '101', '109', '0', sysdate, to_date('31-12-2099 23:59:59', 'dd-mm-yyyy hh24:mi:ss'));"
        self.sqls.append(sql)

    def _gen_package_product(self):
        for prod in self.products:
            prod_type = prod.get('PRODUCT_TYPE', '00')
            prod_id = prod.get('PRODUCT_ID', '')
            mapping_value = prod.get('MAPPING_VALUE', '')
            rule_id = f"to_char(sysdate ,'yyyymmddHH24miss')||crm_user.seq_get_id.nextval"
            sql = f"insert into cme_product.cme_package_product (PACKAGE_PRODUCT_ID, PACKAGE_ID, PRODUCT_ID, PRODUCT_TYPE, MAPPING_VALUE, EFF_FLAG, EFF_DATE, EXP_DATE) values ({rule_id}, {self._escape(self.package_id)}, {self._escape(prod_id)}, {self._escape(prod_type)}, {self._escape(mapping_value)}, '0', sysdate, to_date('31-12-2099 23:59:59', 'dd-mm-yyyy hh24:mi:ss'));"
            self.sqls.append(sql)

    def _gen_package_rule(self):
        sql = f"insert into cme_product.cme_package_rule (PACKAGE_ID, TELE_TYPE, EFF_TYPE, CAN_REFUND, OPEN_ORDER_FLAG, CREDIT_LEVEL, WS_FINISH_FLAG) values ({self._escape(self.package_id)}, {self._escape(self.tele_type)}, {self._escape(self.eff_type)}, {self._escape(self.can_refund)}, {self._escape(self.open_order_flag)}, {self._escape(self.credit_level)}, '1');"
        self.sqls.append(sql)
