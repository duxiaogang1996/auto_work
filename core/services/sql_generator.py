import time
import random
from datetime import datetime

class ProductSqlGenerator:
    def __init__(self, data: dict):
        self.data = data
        self.sqls = []
        
        # 基础数据提取
        self.product_name = self.data.get('PRODUCT_NAME', '')
        self.product_desc = self.data.get('PRODUCT_DESC', '')
        self.product_type = self.data.get('PRODUCT_TYPE', 'T')
        self.product_price = self.data.get('PRODUCT_PRICE', '')
        self.tele_type = self.data.get('TELE_TYPE', 'GSM')
        self.prod_sub_type = self.data.get('PROD_SUB_TYPE', 'M')
        
        # 套餐属性与映射数据
        self.mapping_value = self.data.get('MAPPING_VALUE', '')
        self.vop_product_type = self.data.get('VOP_PRODUCT_TYPE', '')
        self.discount_fee = self.data.get('DISCOUNT_FEE', '')
        self.mapping_pkg_value = self.data.get('MAPPING_PKG_VALUE', '')
        
        # 服务类附加数据
        self.service_type = self.data.get('SERVICE_TYPE', '')
        self.is_only_open = self.data.get('IS_ONLY_OPEN', '1')
        self.reason_codes = self.data.get('REASON_CODES', [])
        self.instructions = self.data.get('INSTRUCTIONS', [])

        # 自动生成的 ID
        self.product_id = self._generate_product_id()
        self.service_pkg_id = f"B{random.randint(100000, 999999)}"
        self.service_id = f"S{random.randint(1000, 9999)}"

    def _generate_product_id(self):
        timestamp = int(time.time())
        rand_str = f"{random.randint(0, 9999999):07d}"
        return f"P{timestamp}{rand_str}"[:20]
        
    def _escape(self, val):
        if val is None or str(val).strip() == '':
            return "null"
        # 转义单引号
        escaped_val = str(val).replace("'", "''")
        return f"'{escaped_val}'"

    def generate(self):
        self.sqls.append("-- 1. 产品表 CODE_PRODUCT")
        self._gen_code_product()
        
        self.sqls.append("\n-- 2. 产品套餐属性表 crm_product.code_product_dinner_attr")
        self._gen_code_product_dinner_attr()
        
        self.sqls.append("\n-- 3. 产品映射表 crm_product.info_product_mapping")
        self._gen_info_product_mapping()
        
        if self.prod_sub_type in ['S', 'B']:
            self.sqls.append("\n-- 4. 产品与服务包关系表 crm_product.rule_product_service_pkg")
            self._gen_rule_product_service_pkg()
            
            self.sqls.append("\n-- 5. 服务包表 crm_product.pkg_service")
            self._gen_pkg_service()
            
            self.sqls.append("\n-- 6. 服务包与服务关系表 crm_product.rule_service_pkg")
            self._gen_rule_service_pkg()
            
            self.sqls.append("\n-- 7. 服务表 crm_product.code_service")
            self._gen_code_service()
            
            self.sqls.append("\n-- 8. 服务与停开原因规则表 crm_pub.rule_reason_service")
            self._gen_rule_reason_service()
            
        if self.prod_sub_type in ['S', 'B', 'P']:
            self.sqls.append("\n-- 9-11. 指令相关表 (RULE_SERVICE_INST, code_inst, COMM_GSM_MAPPING_EXTEND)")
            self._gen_instruction_tables()
            
        return "\n".join(self.sqls)

    def _gen_code_product(self):
        sql = f"insert into CODE_PRODUCT (PRODUCT_ID, PRODUCT_NAME, PRODUCT_DESC, PRODUCT_TYPE, PRODUCT_PRICE, PRODUCT_STATUS, DEPT_ID, EXCLUDE_CODE, EFF_FLAG, EFF_DATE, EXP_DATE, BAR_CODE, TELE_TYPE, PROD_SUB_TYPE) values ({self._escape(self.product_id)}, {self._escape(self.product_name)}, {self._escape(self.product_desc)}, {self._escape(self.product_type)}, {self.product_price if self.product_price else 'null'}, '101', '109', null, '0', sysdate, to_date('31-12-2099 23:59:59', 'dd-mm-yyyy hh24:mi:ss'), null, {self._escape(self.tele_type)}, {self._escape(self.prod_sub_type)});"
        self.sqls.append(sql)

    def _gen_code_product_dinner_attr(self):
        credit_level = "1"
        prod_price_type = self.data.get('PROD_PRICE_TYPE', '')
        prod_level = self.data.get('PROD_LEVEL', '')
        sql = f"insert into crm_product.code_product_dinner_attr (PRODUCT_ID, TELE_TYPE, WS_FINISH_FLAG, CREDIT_LEVEL, PROD_PRICE_TYPE, PROD_LEVEL, EFF_TYPE, OPEN_ORDER_FLAG) values ({self._escape(self.product_id)}, {self._escape(self.tele_type)}, '1', {self._escape(credit_level)}, {self._escape(prod_price_type)}, {self._escape(prod_level)}, '0', '*');"
        self.sqls.append(sql)

    def _gen_info_product_mapping(self):
        product_type = '01' if self.prod_sub_type == 'P' else '00'
        sql = f"insert into crm_product.info_product_mapping (PRODUCT_ID, MAPPING_VALUE, PRODUCT_TYPE, VOP_PRODUCT_TYPE, DISCOUNT_FEE, MAPPING_PKG_VALUE) values ({self._escape(self.product_id)}, {self._escape(self.mapping_value)}, {self._escape(product_type)}, {self._escape(self.vop_product_type)}, {self.discount_fee if self.discount_fee else 'null'}, {self._escape(self.mapping_pkg_value)});"
        self.sqls.append(sql)

    def _gen_rule_product_service_pkg(self):
        rule_id = f"to_char(sysdate ,'yyyymmddHH24miss')||crm_user.seq_get_id.nextval"
        sql = f"insert into crm_product.rule_product_service_pkg (RULE_PRODUCT_SERPKG_ID, PRODUCT_ID, SERVICE_PKG_ID) values ({rule_id}, {self._escape(self.product_id)}, {self._escape(self.service_pkg_id)});"
        self.sqls.append(sql)

    def _gen_pkg_service(self):
        sql = f"insert into crm_product.pkg_service (SERVICE_PKG_ID, SERVICE_PKG_NAME, SERVICE_PKG_DESC, SERVICE_PKG_ATTRIBUTE, EFF_FLAG, EFF_DATE, EXP_DATE, EXCLUDE_FLAG) values ({self._escape(self.service_pkg_id)}, {self._escape(self.product_name)}, {self._escape(self.product_desc)}, null, '0', sysdate, to_date('31-12-2099 23:59:59', 'dd-mm-yyyy hh24:mi:ss'), '0');"
        self.sqls.append(sql)

    def _gen_rule_service_pkg(self):
        rule_id = f"to_char(sysdate ,'yyyymmddHH24miss')||crm_user.seq_get_id.nextval"
        sql = f"insert into crm_product.rule_service_pkg (RULE_SERVICE_PKG_ID, SERVICE_PKG_ID, SERVICE_ID) values ({rule_id}, {self._escape(self.service_pkg_id)}, {self._escape(self.service_id)});"
        self.sqls.append(sql)

    def _gen_code_service(self):
        sql = f"insert into crm_product.code_service (SERVICE_ID, TELE_TYPE, SERVICE_NAME, SERVICE_DESC, SERVICE_TYPE, COMM_FLAG, EXCLUDE_FLAG, SERVICE_PKG_ID, IS_ONLY_OPEN, PROD_ECOSYS_FLAG) values ({self._escape(self.service_id)}, {self._escape(self.tele_type)}, {self._escape(self.product_name)}, {self._escape(self.product_desc)}, {self._escape(self.service_type)}, '0', '0', null, {self._escape(self.is_only_open)}, null);"
        self.sqls.append(sql)

    def _gen_rule_reason_service(self):
        for reason in self.reason_codes:
            code = reason.get('code', '')
            action = reason.get('action', '')
            sql = f"insert into crm_pub.rule_reason_service (REASON_CODE, SERVICE, SERVICE_ACTION, TELE_TYPE) values ({self._escape(code)}, {self._escape(self.service_id)}, {self._escape(action)}, 'GSM');"
            self.sqls.append(sql)

    def _gen_instruction_tables(self):
        action_oper_map = {
            'order': '0',
            'unsubscribe': '1',
            'off': '11',
            'halfoff': '02',
            'on': '01'
        }
        for inst in self.instructions:
            inst_code = f"I{random.randint(10000, 99999)}"
            action = inst.get('ACTION', '')
            vop_code = inst.get('VOP_CODE', '')
            comments = inst.get('COMMENTS_CRM', '')
            dependence = inst.get('DEPENDENCE', '')
            key = inst.get('KEY', '')
            action_pe = inst.get('ACTION_PE', '')
            flag = inst.get('FLAG', '')
            vop_prod = inst.get('VOP_PROD', '')
            
            oper_flag = action_oper_map.get(action, '0')
            
            # 根据需求：订购(order)和退订(unsubscribe)时 SERVICE_ID 字段对应的是 PRODUCT_ID
            # 全停(off)、全开(on)、半停(halfoff)时对应的是 SERVICE_ID
            rule_inst_service_id = self.product_id if action in ['order', 'unsubscribe'] else self.service_id
            
            # 9. RULE_SERVICE_INST
            sql9 = f"insert into CRM_PUB.RULE_SERVICE_INST (TELE_TYPE, PREPAY_FLAG, SERVICE_ID, OPER_FLAG, COMM_TYPE, USER_STATUS, HLR_CODE, INST_CODE, PRIOR_LEVEL, SEQ_ID) values ({self._escape(self.tele_type)}, '*', {self._escape(rule_inst_service_id)}, {self._escape(oper_flag)}, '10', '*', '*', {self._escape(inst_code)}, 1, 80);"
            self.sqls.append(sql9)
            
            # 10. code_inst
            sql10 = f"insert into crm_pub.code_inst (INST_CODE, INST_CODE_NAME, TELE_TYPE, COMM_FLAG) values ({self._escape(inst_code)}, {self._escape(comments)}, {self._escape(self.tele_type)}, '0');"
            self.sqls.append(sql10)
            
            # 11. COMM_GSM_MAPPING_EXTEND
            sql11 = f"insert into crm_pub.COMM_GSM_MAPPING_EXTEND (INST_CODE, COMMENTS_CRM, ACTION, VOP_CODE, COMMENTS_VOP, DEPENDENCE, KEY, ACTION_PE, FLAG, VOP_PROD) values ({self._escape(inst_code)}, {self._escape(comments)}, {self._escape(action)}, {self._escape(vop_code)}, {self._escape(comments)}, {self._escape(dependence)}, {self._escape(key)}, {self._escape(action_pe)}, {self._escape(flag)}, {self._escape(vop_prod)});"
            self.sqls.append(sql11)
